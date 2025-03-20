# Heatmap

A simple sidebar heatmap for Obsidian.

![obsidian-heatmap.gif](file:///obsidian-heatmap.gif)

There were no 'heatmap' plugins that I liked so I made my own. Existing solutions were cumbersome and/or did not integrate well with the Obsidian UI.

## Features
- **Heatmap Visualization**
	- Contribution/GitHub-style heatmap representing daily file activity
	- Colour coding based on create and modify activity
- **Live Refresh** 
	- Scans files in the vault (or an optional target folder) capturing both creation and modification dates
	- Checks hourly
- **Interactive Day Cells** - clicking on a day cell gives a popup with the files for that day
- **Dynamic Resizing** - Responds to the UI and rebuilds the heatmap when the container size changes 
- **Customisable Colour Presets**

## Settings

 Provides
- Target folder to track.
- Change leaf's title e.g. "Vault Heatmap"
- Change leaf icon (using built-in Lucide icons)
- Customisable colour presets via 
	- JSON hex code array
	- Then select a desired colorway preset from a dropdown.

### JSON Palette Format

Each palette is defined as a JSON object with a "name" and a "colours" array containing valid hex codes. For example:

```json
[
  {
    "name": "Warm",
    "colours": ["#FF0000", "#FFA500", "#FFFF00"]
  }
]
```

## Installation & Setup

1. **Install:**  
   - Download or clone the repository.
   - Place the plugin folder (`obsidian-heatmap/`) in your vault’s `.obsidian/plugins/` directory.
   - Enable the plugin from Obsidian’s Community Plugins settings.

2. **Configure:**  
   - Open the plugin settings to set your Target Folder, Leaf Name, and Icon.
   - Edit the JSON for Colourways or choose a preset.
   - The heatmap will appear automatically in the left sidebar.


## Plugin Roadmap

There is not going to be any scope blowout for this plugin, but there are a few QoL features I would like to implement to make this plugin feel polished and complete. 

*Yes*... multiple heatmaps are coming.

- ~~**Core**~~ Done 
	- [x] Folder selection
	- [x] Palette customisation
	- [x] Icon selection
	- [x] Daily refresh
	- [x] Auto-setting application - partially complete
  - [x] **Dynamic Resizing**
  - [x] **Interactive Day Cells**
- **Core+**
	- [ ] **Multiple heatmaps** - Folder-specific individually customizable heatmaps i.e. different heatmaps for different folders
	- [ ]  **UI Adjustment Settings**
		- [ ] Padding adjustment - slider - will try to make automatic/dynamic to suit anyone's UI setup - may need community feedback
		- [ ] Radius of cells - slider
		- [ ] Improve the JSON input field
	- [ ] More **graceful error handling**
- **Extended**
	- [ ] Inline look-ahead **folder suggest modal**
	- [ ] **Icon picker**
	- [ ] **Colourway enhancements**
		- [ ] Palette **gradient preview** on the settings page
		- [ ] **Individual palette editing** - edit individually instead of the entire JSON
		- [ ] **Live error checking** of the JSON input

## Feedback

If you have any feedback, suggestions or bug reports, please feel free to open an issue on the GitHub repository. 