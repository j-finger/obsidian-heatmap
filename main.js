const {
	App,
	Plugin,
	PluginSettingTab,
	Setting,
	ItemView,
	moment,
	setIcon   // NEW: import setIcon utility
} = require("obsidian");

/** ========== SETTINGS ========== */
const DEFAULT_SETTINGS = {
	targetFolder: "", // If blank, track entire vault
	// new settings for colourways
	colourwaysPresetJSON: '[{"name":"Warm","colours":["#FF0000", "#FFA500", "#FFFF00", "#FF1493", "#FF00FF", "#FF4500"]},{"name":"Cool","colours":["#0000FF", "#00FFFF", "#000080", "#800080"]}]',
	selectedColourway: "Warm",
	// new settings for folder name and icon selection
	folderName: "Heatmap",
	iconSelection: "activity"
};

class HeatmapSettingsTab extends PluginSettingTab {
	constructor(app, plugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display() {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "Dynamic Heatmap Settings" });

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

			// New: Folder Name input for title and tooltip use
		new Setting(containerEl)
			.setName("Folder Name")
			.setDesc("Custom name used for the heatmap leaf title, panel tooltip, etc.")
			.addText(text =>
				text
					.setPlaceholder("Heatmap")
					.setValue(this.plugin.settings.folderName)
					.onChange(async (value) => {
						this.plugin.settings.folderName = value.trim();
						await this.plugin.saveSettings();
						this.plugin.refreshHeatmapView();
					})
			);

		// New: Icon Selection input
		new Setting(containerEl)
			.setName("Icon Selection")
			.setDesc("Type the exact icon name from the Lucide icons Obsidian uses.")
			.addText(text =>
				text
					.setPlaceholder("activity")
					.setValue(this.plugin.settings.iconSelection)
					.onChange(async (value) => {
						this.plugin.settings.iconSelection = value.trim();
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

	new Setting(containerEl)
		.setName("Apply changes")
		.setDesc("Apply the changes to the active leaf title and icon.")
		.addButton((btn) => {
			btn.setButtonText("Apply");
			btn.onClick(async () => {
				await this.plugin.saveSettings();
				this.plugin.updateActiveLeaf({
					title: this.plugin.settings.folderName,
					icon: this.plugin.settings.iconSelection
				});
			});
		});
	}
}

/** ========== HEATMAP VIEW ========== */
const HEATMAP_VIEW_TYPE = "heatmap-view";

class HeatmapView extends ItemView {
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
		// Use custom folderName if provided
		return this.plugin.settings.folderName || "Heatmap";
	}

	// NEW: getIcon method so the tab icon updates with settings
	getIcon() {
		return this.plugin.settings.iconSelection || "activity";
	}

	async onOpen() {
		this.containerEl.empty();
		// Update the leaf header icon using the settings
		if (this.leaf && this.leaf.tabHeaderInnerEl) {
			setIcon(this.leaf.tabHeaderInnerEl, this.plugin.settings.iconSelection || "activity");
		}
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

		const COLUMN_WIDTH = 16;
		let numWeeks = Math.floor(containerWidth / COLUMN_WIDTH);
		if (numWeeks < 1) numWeeks = 1;

		const today = moment().startOf("day");
		const startDate = today.clone().subtract(numWeeks - 1, "weeks").startOf("week");

		for (let w = 0; w < numWeeks; w++) {
			const weekDiv = this.gridEl.createDiv({ cls: "heatmap-week" });
			for (let d = 0; d < 7; d++) {
				const currentDate = startDate.clone().add(w, "weeks").add(d, "days");
				// Skip future days
				if (currentDate.isAfter(today)) continue;

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
module.exports = class HeatmapPlugin extends Plugin {
	async onload() {
		console.log("Loading Dynamic Heatmap Plugin (With Default Padding)");

		await this.loadSettings();

		// Register the custom view
		this.registerView(
			HEATMAP_VIEW_TYPE,
			(leaf) => new HeatmapView(leaf, this)
		);

		// Add settings
		this.addSettingTab(new HeatmapSettingsTab(this.app, this));

			// Register a command to reopen the heatmap pane if closed
		this.addCommand({
			id: "reopen-heatmap-pane",
			name: "Reopen Heatmap Pane",
			callback: () => {
				this.activateView();
			}
		});

		// Refresh the heatmap view every hour		
		this.lastDateChecked = new Date().toDateString();
    	this.registerInterval(window.setInterval(() => {
			const currentDate = new Date().toDateString();
			if (currentDate !== this.lastDateChecked) {
				this.lastDateChecked = currentDate;
				this.refreshHeatmapView();
			}
		}, 1000 * 60 * 60)); // checks hourly

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

	updateActiveLeaf(updates) {
		const leaf = this.app.workspace.activeLeaf;
		if (leaf) {
			const currentState = leaf.getViewState();
			leaf.setViewState({
				...currentState,
				state: {
					...currentState.state,
					...updates
				}
			});
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
};
