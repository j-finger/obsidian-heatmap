# Changelog

All notable changes to this plugin will be documented in this file.


## [1.0.1] - 2025-03-23
### Added

- Introduced global constants for view type, default leaf icon, default leaf title, and refresh interval.
- Abstracted hardcoded variables into global scope.
- Refactored inline CSS styling into CSS classes.
- Updated parameter names for clarity:
  - folderName → heatmapLeafTitle
  - iconSelection → heatmapLeafIcon
  - targetFolder → trackedFolderPath
  - colourwaysPresetJSON → colourPresetsJSON
- Enhanced settings display by clearing the container element on each display call.
- Updated settings text fields to use sentence case and replaced h2 headings with .setHeading() in the settings UI.
- Updated manifest.json, package.json, and CHANGELOG.md to include patch details and the new iteration.

### Fixed

- Corrected the incorrectly imported function from normalisePath to normalizePath.
- Improved folder validation logic to ensure only valid folder paths or blank input (for the entire vault) are accepted.
- Enhanced error handling and fallback logic when parsing colourPresetsJSON to ensure valid colour arrays are used.
- Fixed view refresh and active leaf update issues so that changes to settings (leaf title, icon, etc.) are correctly applied.
- Removed redundant code comments and duplicate functions to streamline the codebase.
- Updated naming conventions and UI text to use sentence case and eliminate redundant headings (conforming with UI text and naming guidelines).
- Replaced inline CSS with CSS classes and leveraged Obsidian helper functions for safe DOM manipulation (aligns with DOM Manipulation and Styling guidelines).
- Corrected the import from normalisePath to normalizePath, ensuring proper cross-platform file path handling (File System API and Path Handling).
- Cleared container elements and removed duplicate functions to improve resource management and cleanup (Resource Management and Custom Views).

## [1.0.0] - 2025-03-20
### Added
- Initial release of the Obsidian Heatmap plugin.
- File activity tracking for visualizing vault contributions.
- Dynamic heatmap view with configurable color presets.
- Settings tab with options to set target folder, leaf name, icon selection, and palettes.
- Real-time validation for target folder and icon settings.
- Interactive day cells with file popup list.
- Automatic daily refresh of the heatmap view.
- Reopen command to bring the heatmap pane back if closed.

### Fixed
- Basic error handling for JSON parsing and invalid inputs.
- Responsive design via ResizeObserver.
