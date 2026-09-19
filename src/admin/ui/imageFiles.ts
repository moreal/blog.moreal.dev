export function captureImageFiles(transfer: DataTransfer): File[] {
  const files: File[] = [];
  for (const item of transfer.items) {
    if (item.kind !== "file" || !item.type.startsWith("image/")) continue;
    const file = item.getAsFile();
    if (file !== null) files.push(file);
  }
  return files;
}
