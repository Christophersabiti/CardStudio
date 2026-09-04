import type { GroupMember } from "./types";

const MAX_MEMBERS = 500;

/** Column header aliases (lowercased, spaces/underscores/hyphens stripped) -> GroupMember field. */
const HEADER_ALIASES: Record<string, keyof GroupMember> = {
  firstname: "firstName",
  first: "firstName",
  givenname: "firstName",
  lastname: "lastName",
  last: "lastName",
  surname: "lastName",
  familyname: "lastName",
  name: "firstName", // single "Name" column: treated as full name, split on first space below
  title: "title",
  jobtitle: "title",
  designation: "title",
  organization: "organization",
  organisation: "organization",
  company: "organization",
  org: "organization",
  phone: "phone",
  phonenumber: "phone",
  mobile: "phone",
  cell: "phone",
  tel: "phone",
  email: "email",
  emailaddress: "email",
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

/** Parse one CSV line into fields, honoring double-quoted values with embedded commas/quotes. */
function parseLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(field);
      field = "";
    } else {
      field += c;
    }
  }
  out.push(field);
  return out;
}

export interface ParsedCsv {
  members: GroupMember[];
  /** Row numbers (1-based, header excluded) that were skipped, with why. */
  errors: string[];
}

/**
 * Parse a bulk-contacts CSV into GroupMembers. Requires a header row; matches
 * common column-name variants case-insensitively (see HEADER_ALIASES). A row
 * needs at least a name to be kept — phone/email are optional but recommended.
 */
export function parseMembersCsv(text: string): ParsedCsv {
  const lines = text.split(/\r\n|\r|\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { members: [], errors: ["The file is empty."] };

  const headerCells = parseLine(lines[0]).map(normalizeHeader);
  const fieldByCol = headerCells.map((h) => HEADER_ALIASES[h]);
  const isSingleNameCol = headerCells.some((h) => h === "name");

  if (!fieldByCol.some(Boolean)) {
    return {
      members: [],
      errors: [
        'No recognized columns in the header row. Expected something like "First Name, Last Name, Title, Organization, Phone, Email".',
      ],
    };
  }

  const members: GroupMember[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (members.length >= MAX_MEMBERS) {
      errors.push(`Stopped at ${MAX_MEMBERS} people — remaining rows were not imported.`);
      break;
    }
    const cells = parseLine(lines[i]);
    const m: GroupMember = { firstName: "", lastName: "", title: "", organization: "", phone: "", email: "" };
    cells.forEach((raw, idx) => {
      const field = fieldByCol[idx];
      if (!field) return;
      const value = raw.trim();
      if (field === "firstName" && isSingleNameCol) {
        const [first, ...rest] = value.split(/\s+/);
        m.firstName = first || "";
        m.lastName = rest.join(" ");
      } else {
        m[field] = value;
      }
    });

    if (!m.firstName && !m.lastName) {
      errors.push(`Row ${i + 1}: skipped — no name.`);
      continue;
    }
    members.push(m);
  }

  return { members, errors };
}
