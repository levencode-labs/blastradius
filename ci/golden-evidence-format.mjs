/** Canonical Git JSON evidence is LF text; Windows checkout may materialize CRLF. */
export function sameGoldenEvidence(checkedOut,generated){
  // Normalize only transport line endings, not data, ordering, omitted cases,
  // certainty, metrics or semantic content. A changed report must still fail.
  return checkedOut.replace(/\r\n/g,'\n')===generated;
}
