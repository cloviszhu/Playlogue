declare const __PLAYLOGUE_BUILD_ID__:string;
// Builds inject a SHA-256 of the actual production sources; direct source runs stay explicit.
export const buildVersion=typeof __PLAYLOGUE_BUILD_ID__==='string'?__PLAYLOGUE_BUILD_ID__:'v0.1.0';
