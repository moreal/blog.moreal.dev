const IMAGE_BASE_NAME = /^[a-z0-9][a-z0-9._-]*$/;

export function normalizedImageBaseName(name: string): string {
  return name.trim().toLowerCase();
}

export function isImageBaseName(normalizedName: string): boolean {
  return IMAGE_BASE_NAME.test(normalizedName);
}

export function imageMarkdown(fileName: string): string {
  return `![](./${fileName})`;
}
