export type TemplateVars = {
  first_name?: string | null;
  last_name?: string | null;
  ig_username?: string | null;
};

// Replace {{var}} occurrences with vars. Unknown / null / undefined → empty string.
// Never throws — safe to call with empty vars.
export function renderTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_match, key: string) => {
    const v = vars[key as keyof TemplateVars];
    return v == null ? "" : String(v);
  });
}
