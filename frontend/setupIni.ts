// Preserve unrelated sections, ordering and comments when editing form fields.
export function iniValue(contents: string, section: string, key: string): string {
  let current = "";
  for (const line of contents.split(/\r?\n/)) {
    const text = line.trim();
    if (text.startsWith("[") && text.endsWith("]")) current = text.slice(1, -1).trim();
    else if (current === section && !text.startsWith(";") && !text.startsWith("#")) {
      const equals = text.indexOf("=");
      if (equals >= 0 && text.slice(0, equals).trim() === key) return text.slice(equals + 1).trim();
    }
  }
  return "";
}
export function setIniValue(contents: string, section: string, key: string, value: string): string {
  const lines = contents.split(/\r?\n/);
  let current = "", end = lines.length, found = false;
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i].trim();
    if (text.startsWith("[") && text.endsWith("]")) {
      if (current === section) { end = i; break; }
      current = text.slice(1, -1).trim();
      if (current === section) found = true;
    } else if (current === section && !text.startsWith(";") && !text.startsWith("#") && text.split("=")[0].trim() === key) {
      lines[i] = value ? `${key} = ${value}` : `; ${key} =`;
      return lines.join("\n");
    }
  }
  if (!found) lines.push(`[${section}]`);
  lines.splice(found ? end : lines.length, 0, value ? `${key} = ${value}` : `; ${key} =`);
  return lines.join("\n");
}
