const rules = new Intl.PluralRules("ru");

export function pluralRu(count: number, one: string, few: string, many: string): string {
  const form = rules.select(count);
  return form === "one" ? one : form === "few" ? few : many;
}
