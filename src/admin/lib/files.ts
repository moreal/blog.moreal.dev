import { promises as fs } from "node:fs";

export async function fileExists(abs: string): Promise<boolean> {
  try {
    await fs.access(abs);
    return true;
  } catch {
    return false;
  }
}

export async function writeWithoutClobbering(abs: string, data: string | Uint8Array): Promise<void> {
  await fs.writeFile(abs, data, { flag: "wx" });
}
