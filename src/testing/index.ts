// The testing subpath export: the verification harness a consumer needs
// to drive the kit the way the package's own suites do — a recording
// stand-in for the canvas context (deterministic render logs), a sentinel
// theme that turns every token into a unique marker (leaked style
// literals fail the test), and the style-literal counter for budget
// suites. Deliberately not part of the main entry: import it as
// '@hoard-engine/uikit/testing'.

export * from './recordingContext';
export * from './sentinelTheme';
export * from './literalBudget';
