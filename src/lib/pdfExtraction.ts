export type ParsedRequestEntry = {
  id: string;
  personName: string;
  personLastName: string;
  personFirstName: string;
  building: string;
  department: string;
  keyStamp: string;
  roomDescription: string;
  dateIssued: string;
  notes: string;
};

export type ParsedReturnEntry = {
  id: string;
  personName: string;
  keyStamp: string;
  roomDescription: string;
  dateReturned: string;
};

function normalizePdfText(text: string) {
  return text
    .replace(/\u00a0/g, " ") // non-breaking space
    .replace(/\r\n/g, "\n")   // windows line endings
    .replace(/\r/g, "\n")     // old mac line endings
    .replace(/[ \t]+/g, " ")  // multiple spaces/tabs to single space
    .trim();
}

function parseIsoDate(dateStr: string): string {
  if (!dateStr.trim()) return "";
  const normalized = dateStr.trim();
  
  // Handle various formats: d/d/yyyy, d-d-yy, m/d/y, etc.
  let match = normalized.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/);
  if (!match) return "";
  
  let month = match[1].padStart(2, "0");
  let day = match[2].padStart(2, "0");
  let year = match[3].length === 2 ? `20${match[3]}` : match[3];
  
  return `${year}-${month}-${day}`;
}

function extractAllDates(text: string): string[] {
  // Extract all dates in various formats
  const datePattern = /(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/g;
  const dates: string[] = [];
  let match;
  
  while ((match = datePattern.exec(text)) !== null) {
    const iso = parseIsoDate(match[0]);
    if (iso && !dates.includes(iso)) {
      dates.push(iso);
    }
  }
  
  return dates;
}

function findName(text: string): string {
  // Look for name in various contexts. The first two patterns' lookaheads
  // must accept a bare line break, not just the next label — most PDFs hand
  // pdfjs one text item per line, so "Date"/"Building" etc. almost always sit
  // on the following line rather than right after the value with no \n
  // between them.
  const patterns = [
    /Name\s*:[\s_]*([^\n:]+?)(?=\n|Date|Building|Department|$)/i,
    /(?:person\s+)?receiving\s+keys\s*:[\s_]*([^\n:]+?)(?=\n|Date|$)/i,
    /Name[\s_]*:?[\s_]*([A-Z][a-z]+[\s_]+[A-Z][a-z]+)(?=\s|$|\n)/,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const name = match[1].replace(/[_\s]+/g, " ").trim();
      if (name.length > 2 && !name.toLowerCase().includes("date") && !name.toLowerCase().includes("key")) {
        return name;
      }
    }
  }
  
  return "";
}

function findBuilding(text: string): string {
  // The label being matched against and the value's own line-ending both end
  // a field, so the lookahead has to accept either — a line break shows up
  // here whenever the form's fields are one text item per line (the common
  // case), not just when two labels share a single line.
  const patterns = [
    /Building\s*(?:\/\s*Location)?\s*:[\s_]*([^\n]+?)(?=\n|Department|$)/i,
    /Location\s*:[\s_]*([^\n]+?)(?=\n|Date|$)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const building = match[1].replace(/[_\s]+/g, " ").trim();
      if (building.length > 0 && !building.match(/^\d+$/) && building.length < 100) {
        return building;
      }
    }
  }
  
  return "";
}

function findDepartment(text: string): string {
  const patterns = [
    /Department\s*:[\s_]*([^\n]+?)(?=\n|Number|Index|Building|Key|Work Order|$)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const dept = match[1].replace(/[_\s]+/g, " ").trim();
      if (dept.length > 0 && !dept.match(/^\d+$/) && dept.length < 100) {
        return dept;
      }
    }
  }
  
  return "";
}

function findAllKeyStamps(text: string): Map<string, string> {
  // Find key stamps in the dotted formats DSU actually uses: 12.16, 25A.3, 2A.9.
  //
  // This deliberately does NOT fall back to bare "isolated" digit patterns
  // (a lone \d{4}, or \d{2}\s+\d{2}) — those false-positive constantly on real
  // documents: a DocuSign envelope ID fragment ("...0762...") or the year in a
  // date ("06/25/2026") both look exactly like an "isolated 4-digit stamp" to
  // a context-free regex. None of DSU's documented stamp formats need that
  // fallback (dotted forms are covered here; dotless letter-prefixed forms
  // like "H24" or "5D22" aren't reliably extractable from free text at all —
  // they're too easily confused with ordinary words/codes on the page).
  const stamps = new Map<string, string>();
  const patterns = [
    /\b(\d+[A-Z]?\.\d+)\b/g,           // 12.16, 25A.3, 2A.9
  ];

  for (const pattern of patterns) {
    let stampMatch;
    while ((stampMatch = pattern.exec(text)) !== null) {
      const stamp = stampMatch[1];

      // Skip if we've already found this stamp
      if (stamps.has(stamp)) continue;
      
      // Try to find description after the stamp
      const contextAfter = text.substring(stampMatch.index + stampMatch[0].length, stampMatch.index + stampMatch[0].length + 300);
      
      let description = "";
      const descPatterns = [
        /^\s+([A-Za-z][A-Za-z0-9\s\-\/()]*?)(?=\n|Return Date|Initials|$)/i,
        /^\s+([^\n]{1,100}?)(?=\n|$)/,
      ];
      
      for (const descPattern of descPatterns) {
        const descMatch = contextAfter.match(descPattern);
        if (descMatch) {
          description = descMatch[1]
            .replace(/[_\s]+/g, " ")
            .trim()
            .replace(/^[\d\s\/\-]+/, "")
            .trim();
          
          if (description.length > 0 && description.length < 200 && !description.match(/^\d{1,2}\/\d{1,2}/)) {
            break;
          }
        }
      }
      
      stamps.set(stamp, description);
    }
    
    // Reset lastIndex for global regex
    pattern.lastIndex = 0;
  }
  
  return stamps;
}

export function extractParsedRequests(text: string): ParsedRequestEntry[] {
  const normalized = normalizePdfText(text);
  const entries: ParsedRequestEntry[] = [];

  // Extract top-level fields
  const personName = findName(normalized);
  const building = findBuilding(normalized);
  const department = findDepartment(normalized);
  
  // Find all dates - use the first one as issued date
  const dates = extractAllDates(normalized);
  const dateIssued = dates.length > 0 ? dates[0] : "";

  // Find all key stamps
  const stamps = findAllKeyStamps(normalized);

  // Create entries for each stamp
  stamps.forEach((description, stamp) => {
    const nameParts = personName.trim().split(/\s+/).filter(Boolean);
    const firstName = nameParts.slice(0, -1).join(" ");
    const lastName = nameParts[nameParts.length - 1] ?? "";
    
    entries.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      personName: personName,
      personLastName: lastName,
      personFirstName: firstName,
      building: building,
      department: department,
      keyStamp: stamp,
      roomDescription: description,
      dateIssued: dateIssued,
      notes: "",
    });
  });

  return entries;
}

export function extractReturnRequests(text: string): ParsedReturnEntry[] {
  const normalized = normalizePdfText(text);
  const entries: ParsedReturnEntry[] = [];

  // Extract person name - try multiple approaches
  let personName = findName(normalized);
  
  // If no name found with standard approach, look more aggressively
  if (!personName) {
    // Look for any capitalized words that might be a name
    const namePatterns = [
      /[A-Z][a-z]+\s+[A-Z][a-z]+/,  // First Last
      /[A-Z]{2,}[A-Z][a-z]+/,        // ZAKK Evers format
    ];
    for (const pattern of namePatterns) {
      const match = normalized.match(pattern);
      if (match) {
        personName = match[0].trim();
        break;
      }
    }
  }

  // Find all dates - use the last one as return date (return usually comes later in doc)
  const dates = extractAllDates(normalized);
  const dateReturned = dates.length > 0 ? dates[dates.length - 1] : "";

  // Find all key stamps - this is critical
  const stamps = findAllKeyStamps(normalized);
  
  // If still no stamps, do a very aggressive search
  if (stamps.size === 0) {
    // Look for any number.number pattern or numbers in tables
    const aggressivePattern = /(\d+)[.\s\/](\d+)/g;
    let match;
    while ((match = aggressivePattern.exec(normalized)) !== null) {
      const stamp = `${match[1]}.${match[2]}`;
      // Filter out obvious dates and non-stamps
      if (!stamps.has(stamp) && match[1].length <= 3 && match[2].length <= 3) {
        stamps.set(stamp, "");
      }
    }
  }

  // Create entries for each stamp
  stamps.forEach((description, stamp) => {
    entries.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      personName: personName,
      keyStamp: stamp,
      roomDescription: description,
      dateReturned: dateReturned,
    });
  });

  return entries;
}

