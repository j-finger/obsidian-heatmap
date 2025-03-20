const {
	App,
	Plugin,
	PluginSettingTab,
	Setting,
	ItemView,
	moment
} = require("obsidian");

/** ========== SETTINGS ========== */
const DEFAULT_SETTINGS = {
	targetFolder: "", // If blank, track entire vault
	// new settings for colourways
	colourwaysPresetJSON: '[{"name":"Warm","colours":["#FF0000", "#FFA500", "#FFFF00", "#FF1493", "#FF00FF", "#FF4500"]},{"name":"Cool","colours":["#0000FF", "#00FFFF", "#000080", "#800080"]}]',
	selectedColourway: "Warm"
};

class MinimalHeatmapSettingsTab extends PluginSettingTab {
	constructor(app, plugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display() {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "Minimal Dynamic Heatmap Settings" });

		// Folder selection section
		new Setting(containerEl)
			.setName("Target Folder")
			.setDesc("Track only files in this folder (and subfolders). Leave blank for entire vault.")
			.addText((text) =>
				text
					.setPlaceholder("e.g. FolderA/Subfolder")
					.setValue(this.plugin.settings.targetFolder)
					.onChange(async (value) => {
						this.plugin.settings.targetFolder = value.trim();
						await this.plugin.saveSettings();
						this.plugin.refreshHeatmapView();
					})
			);

		// Colourways input section
		new Setting(containerEl)
			.setName("Colourways Presets JSON")
			.setDesc("Define the colourways (each as an object with a 'name' and a 'colours' array).")
			.addTextArea(textArea =>
				textArea
					.setPlaceholder('e.g. [{"name": "Warm", "colours": ["#FF0000", "#FFA500", ...]}]')
					.setValue(this.plugin.settings.colourwaysPresetJSON)
					.onChange(async (value) => {
						this.plugin.settings.colourwaysPresetJSON = value.trim();
						await this.plugin.saveSettings();
						// Refresh the settings UI to update the dropdown options
						this.display();
						this.plugin.refreshHeatmapView();
					})
			);

		let presetOptions = {};
		try {
			const presets = JSON.parse(this.plugin.settings.colourwaysPresetJSON);
			presets.forEach(preset => {
				if (preset.name)
					presetOptions[preset.name] = preset.name;
			});
		} catch (error) {
			presetOptions["Warm"] = "Warm";
		}

		new Setting(containerEl)
			.setName("Select Colourway")
			.setDesc("Choose a colourway preset.")
			.addDropdown(drop =>
				drop
					.addOptions(presetOptions)
					.setValue(this.plugin.settings.selectedColourway)
					.onChange(async (value) => {
						this.plugin.settings.selectedColourway = value;
						await this.plugin.saveSettings();
						this.plugin.refreshHeatmapView();
					})
			);
	}
}

/** ========== HEATMAP VIEW ========== */
const HEATMAP_VIEW_TYPE = "heatmap-view";

class MinimalHeatmapView extends ItemView {
	constructor(leaf, plugin) {
		super(leaf);
		this.plugin = plugin;

		this.dailyCounts = null;
		this.resizeObserver = null;
		this.lastWidth = 0;
	}

	getViewType() {
		return HEATMAP_VIEW_TYPE;
	}

	getDisplayText() {
		return "Minimal Heatmap";
	}

	async onOpen() {
		this.containerEl.empty();

		// Add a class to style the container with Obsidian's default padding
		this.containerEl.classList.add("heatmap-default-padding");

		// Create a child container for the heatmap
		this.heatmapContainer = this.containerEl.createDiv({ cls: "heatmap-container" });

		// Prepare the grid element
		this.gridEl = this.heatmapContainer.createDiv({ cls: "heatmap-grid" });

		// Gather file activity
		this.dailyCounts = await this.gatherFileActivity();

		// Observe size changes
		this.setupResizeObserver();
	}

	onClose() {
		if (this.resizeObserver) {
			this.resizeObserver.disconnect();
		}
	}

	setupResizeObserver() {
		if (!this.heatmapContainer) return;
		this.resizeObserver = new ResizeObserver((entries) => {
			for (let entry of entries) {
				const w = entry.contentRect.width;
				// Only rebuild if width changes by >= 2px to avoid flicker
				if (Math.abs(w - this.lastWidth) >= 2) {
					this.buildHeatmap(w);
					this.lastWidth = w;
				}
			}
		});
		this.resizeObserver.observe(this.heatmapContainer);

		// Initial build
		const initialWidth = this.heatmapContainer.offsetWidth;
		this.buildHeatmap(initialWidth);
		this.lastWidth = initialWidth;
	}

	buildHeatmap(containerWidth) {
		if (!this.gridEl || !this.dailyCounts) return;
		this.gridEl.empty();

		// Each column is ~16px (12px cell + ~4px gap).
		const COLUMN_WIDTH = 16;
		let numWeeks = Math.floor(containerWidth / COLUMN_WIDTH);
		if (numWeeks < 1) numWeeks = 1; // at least 1 column

		const today = moment().startOf("day");
		const startDate = today.clone().subtract(numWeeks - 1, "weeks").startOf("week");

		for (let w = 0; w < numWeeks; w++) {
			const weekDiv = this.gridEl.createDiv({ cls: "heatmap-week" });
			for (let d = 0; d < 7; d++) {
				const currentDate = startDate.clone().add(w, "weeks").add(d, "days");
				const dateKey = currentDate.format("YYYY-MM-DD");
				const count = this.dailyCounts[dateKey] || 0;

				const dayCell = weekDiv.createDiv({ cls: "heatmap-day" });
				dayCell.setAttr("data-date", dateKey);
				dayCell.setAttr("data-count", count);
				dayCell.setAttr("title", `${dateKey}: ${count} changes`);
				dayCell.style.backgroundColor = this.getColor(count);
			}
		}
	}

	async gatherFileActivity() {
		const dailyCounts = {};
		const files = this.app.vault.getFiles();
		const folderPath = this.plugin.settings.targetFolder;

		for (const file of files) {
			if (!this.isInTargetFolder(file, folderPath)) continue;

			const { ctime, mtime } = file.stat;
			const cDate = moment(ctime).startOf("day").format("YYYY-MM-DD");
			const mDate = moment(mtime).startOf("day").format("YYYY-MM-DD");

			dailyCounts[cDate] = (dailyCounts[cDate] || 0) + 1;
			dailyCounts[mDate] = (dailyCounts[mDate] || 0) + 1;
		}
		return dailyCounts;
	}

	isInTargetFolder(file, folderPath) {
		if (!folderPath) return true;
		return file.path.toLowerCase().startsWith(folderPath.toLowerCase() + "/");
	}

	getColor(count) {
		if (count === 0) return "#ebedf0";
		let presetColours = [];
		try {
			let presets = JSON.parse(this.plugin.settings.colourwaysPresetJSON);
			let preset = presets.find(p => p.name === this.plugin.settings.selectedColourway);
			if (preset && Array.isArray(preset.colours)) {
				presetColours = preset.colours;
			}
		} catch (err) {
			// fallback to default colours
		}
		if (!presetColours.length) {
			presetColours = ["#FF0000", "#FFA500", "#FFFF00", "#FF1493", "#FF00FF", "#FF4500"];
		}
		const index = Math.min(count - 1, presetColours.length - 1);
		return presetColours[index];
	}
}

/** ========== MAIN PLUGIN CLASS ========== */
module.exports = class MinimalHeatmapPlugin extends Plugin {
	async onload() {
		console.log("Loading Minimal Dynamic Heatmap Plugin (With Default Padding)");

		await this.loadSettings();

		// Register the custom view
		this.registerView(
			HEATMAP_VIEW_TYPE,
			(leaf) => new MinimalHeatmapView(leaf, this)
		);

		// Add settings
		this.addSettingTab(new MinimalHeatmapSettingsTab(this.app, this));

		// Automatically open in the left sidebar
		this.activateView();
	}

	onunload() {
		this.app.workspace.detachLeavesOfType(HEATMAP_VIEW_TYPE);
	}

	async activateView() {
		this.app.workspace.detachLeavesOfType(HEATMAP_VIEW_TYPE);
		const leaf = this.app.workspace.getLeftLeaf(false);
		await leaf.setViewState({
			type: HEATMAP_VIEW_TYPE,
			active: true,
		});
		this.app.workspace.revealLeaf(leaf);
	}

	refreshHeatmapView() {
		const leaves = this.app.workspace.getLeavesOfType(HEATMAP_VIEW_TYPE);
		if (leaves.length) {
			leaves[0].view.onOpen();
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
};
