/** Touch devices should not open the software keyboard as soon as a dialog appears. */
export function shouldAutofocusImageDialog(coarsePointer: boolean): boolean {
  return !coarsePointer;
}
