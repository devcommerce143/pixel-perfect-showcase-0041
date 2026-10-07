const TEMPLATE_VARIABLE = /\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g;

export function extractTemplateVariables(...content: (string | null | undefined)[]): string[] {
  const variables = new Set<string>();
  for (const part of content) {
    if (!part) continue;
    for (const match of part.matchAll(TEMPLATE_VARIABLE)) {
      if (match[1]) variables.add(match[1]);
    }
  }
  return [...variables];
}

export function hasMalformedTemplateVariables(...content: (string | null | undefined)[]): boolean {
  return content.some((part) => !!part && /\{\{|\}\}/.test(part.replace(TEMPLATE_VARIABLE, "")));
}

export function renderTemplateVariables(content: string, values: Record<string, string>): string {
  return content.replace(TEMPLATE_VARIABLE, (placeholder, variable: string) => values[variable]?.trim() || placeholder);
}
