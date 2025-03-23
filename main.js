const {
	App,
	Plugin,
	PluginSettingTab,
	Setting,
	ItemView,
	moment,
	setIcon,
	normalizePath,
	TFolder   // NEW: import TFolder for target folder validation
} = require("obsidian");

/** ========== SETTINGS ========== */

const DEFAULT_SETTINGS = {
    targetFolder: "",
    // Put your default colourways here as a string
    colourwaysPresetJSON: JSON.stringify([
        {
            "name": "Warm 1",
            "colours": ["#ffc000", "#fda456", "#f7642e", "#ff4948"]
        },
        {
            "name": "Warm 2",
            "colours": ["#FFC000", "#FDA456", "#F7642E", "#FF4948", "#FE0000", "#FF0A6F", "#F95CB3", "#FF9ADE"]
        },
        {
            "name": "Miami",
            "colours": ["#4CC9F0", "#4361ee", "#3a0ca3", "#560bad", "#7209b7", "#b5179e", "#f72585"]
        },
        {
            "name": "Github",
            "colours": ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"]
        },
        {
            "name": "Cool",
            "colours": ["#84DCC6", "#A5FFD6", "#00A7E1", "#007EA7", "#003459"]
        },
        {
            "name": "Natural",
            "colours": ["#d9ed92", "#b5e48c", "#99d98c", "#76c893", "#52b69a", "#34a0a4", "#168aad", "#1a759f", "#1e6091", "#184e77"]
        }
    ]),
    selectedColourway: "Natural",
    folderName: "Vault Heatmap",
    iconSelection: "activity"
};

class HeatmapSettingsTab extends PluginSettingTab {
	constructor(app, plugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	// Helper functions for basic validations
	isValidFolder(folderPath) {
		if (!folderPath.trim()) return true; // blank is allowed (entire vault)
		const file = this.app.vault.getAbstractFileByPath(folderPath.trim());
		return file && file instanceof TFolder;
	}

	isValidIcon(iconName) {
		// Minimal check: non-empty string
		return iconName.trim().length > 0;
	}

	display() {
		const { containerEl } = this;

		// Target Folder setting with validation
		new Setting(containerEl)
			.setName("Target Folder")
			.setDesc("Track only files in this folder (and subfolders). Leave blank for entire vault.")
			.addText((text) => {
				text
					.setPlaceholder("e.g. FolderA/Subfolder")
					.setValue(this.plugin.settings.targetFolder)
					.onChange(async (value) => {
						// Remove extraneous spaces and normalize path
						let normalizedFolder = normalizePath(value.trim());
						this.plugin.settings.targetFolder = normalizedFolder;
						// Validate folder – change border color accordingly
						if (!this.isValidFolder(normalizedFolder)) {
							text.inputEl.style.borderColor = "red";
						} else {
							text.inputEl.style.borderColor = "";
						}
						await this.plugin.saveSettings();
						this.plugin.refreshHeatmapView();
					});
				// Initial validation using normalized value
				let normalizedFolder = normalizePath(this.plugin.settings.targetFolder);
				if (!this.isValidFolder(normalizedFolder)) {
					text.inputEl.style.borderColor = "red";
				}
			});

		// Folder Name setting (no validation needed)
		new Setting(containerEl)
			.setName("Leaf Name")
			.setDesc("Custom name used for the heatmap leaf title, panel tooltip, etc.")
			.addText((text) =>
				text
					.setPlaceholder("Heatmap")
					.setValue(this.plugin.settings.folderName)
					.onChange(async (value) => {
						this.plugin.settings.folderName = value.trim();
						await this.plugin.saveSettings();
						this.plugin.refreshHeatmapView();
					})
			);

		// Icon Selection with simple validation check
		const iconSetting = new Setting(containerEl)
			.setName("Leaf Icon")
			.setDesc("Loading...") // temporary text; overridden below
			.addText((text) => {
				text
					.setPlaceholder("activity")
					.setValue(this.plugin.settings.iconSelection)
					.onChange(async (value) => {
						this.plugin.settings.iconSelection = value.trim();
						// Validate icon (for example, non-empty text)
						if (!this.isValidIcon(this.plugin.settings.iconSelection)) {
							text.inputEl.style.borderColor = "red";
						} else {
							text.inputEl.style.borderColor = "";
						}
						await this.plugin.saveSettings();
						this.plugin.refreshHeatmapView();
					});
				// Initial validation check
				if (!this.isValidIcon(this.plugin.settings.iconSelection)) {
					text.inputEl.style.borderColor = "red";
				}
			});
		// Override description to include HTML link without innerHTML
		iconSetting.descEl.empty();
		iconSetting.descEl.createEl("span", { text: "Type the exact " });
		const link = iconSetting.descEl.createEl("a", { text: "Lucide icon" });
		link.href = "https://lucide.dev/icons/";
		link.target = "_blank";
		link.rel = "noopener";
		iconSetting.descEl.createEl("span", { text: " name" });

		// Apply and Reset buttons on the same line – styled as CTA using .setCta()
		const buttonSetting = new Setting(containerEl)
			.setName("Actions")
			.setDesc("Apply or reset the settings.");
		buttonSetting.addButton((btn) => {
			btn.setButtonText("Apply changes")
				.setCta()
				.onClick(async () => {
					await this.plugin.saveSettings();
					this.plugin.updateActiveLeaf({
						title: this.plugin.settings.folderName,
						icon: this.plugin.settings.iconSelection
					});
				});
		});
		buttonSetting.addButton((btn) => {
			btn.setButtonText("Reset to defaults")
				.setCta()
				.onClick(async () => {
					Object.assign(this.plugin.settings, DEFAULT_SETTINGS);
					await this.plugin.saveSettings();
					this.plugin.refreshHeatmapView();
					this.display();
				});
		});

		// Divider and Colour Settings Header
		containerEl.createEl("h2", { text: "Colour" });

		// Colourways input section
		new Setting(containerEl)
			.setName("Colourways Presets JSON")
			.setDesc("Define the colourways (each as an object with a 'name' and 'colours' array). Best edited in a code editor.")
			.addTextArea((textArea) => {
				textArea
					.setPlaceholder('e.g. [{"name": "Warm", "colours": ["#FF0000", "#FFA500", ...]}]')
					.setValue(this.plugin.settings.colourwaysPresetJSON)
					.onChange(async (value) => {
						this.plugin.settings.colourwaysPresetJSON = value.trim();
						await this.plugin.saveSettings();
						// Refresh the settings UI to update the dropdown options
						this.display();
						this.plugin.refreshHeatmapView();
					});
				textArea.inputEl.style.height = "150px";
				textArea.inputEl.style.width = "450px";
			});

		let presetOptions = {};
		try {
			const presets = JSON.parse(this.plugin.settings.colourwaysPresetJSON);
			presets.forEach((preset) => {
				if (preset.name) presetOptions[preset.name] = preset.name;
			});
		} catch (error) {
			presetOptions["Natural"] = "Natural";
		}

		new Setting(containerEl)
			.setName("Select Colourway")
			.setDesc("Choose a colourway preset.")
			.addDropdown((drop) =>
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

				dayCell.addEventListener("click", (evt) => {
					this.showDayPopup(evt, dateKey);
				});
			}
		}
	}

	async gatherFileActivity() {
		this.dailyFiles = {};
		const dailyCounts = {};
		const files = this.app.vault.getFiles();
		const folderPath = this.plugin.settings.targetFolder;

		for (const file of files) {
			if (!this.isInTargetFolder(file, folderPath)) continue;

			const cDate = moment(file.stat.ctime).startOf("day").format("YYYY-MM-DD");
			const mDate = moment(file.stat.mtime).startOf("day").format("YYYY-MM-DD");

			dailyCounts[cDate] = (dailyCounts[cDate] || 0) + 1;
			dailyCounts[mDate] = (dailyCounts[mDate] || 0) + 1;

			this.dailyFiles[cDate] = this.dailyFiles[cDate] || [];
			this.dailyFiles[mDate] = this.dailyFiles[mDate] || [];
			this.dailyFiles[cDate].push(file.path);
			this.dailyFiles[mDate].push(file.path);
		}
		return dailyCounts;
	}

	showDayPopup(evt, dateKey) {
		document.querySelectorAll(".day-popup").forEach(el => el.remove());
	
		const filesForDate = this.dailyFiles?.[dateKey] || [];
		if (!filesForDate.length) return;
	
		const popup = createDiv({ cls: "day-popup" });
		popup.style.position = "absolute";
		popup.style.left = evt.pageX + "px";
		popup.style.top = evt.pageY + "px";
		popup.style.zIndex = 9999;
	
		filesForDate.forEach(path => {
			// Extract only the filename from the full path
			const filename = path.split("/").pop();
			const linkEl = popup.createEl("a", { text: filename });
			linkEl.href = "#";
			linkEl.style.display = "block";
			linkEl.addEventListener("click", (e) => {
				e.preventDefault();
				this.openFile(path);
				popup.remove();
			});
		});
	
		document.body.appendChild(popup);
	
		// Adjust if the popup goes off-screen
		window.requestAnimationFrame(() => {
			const rect = popup.getBoundingClientRect();
			if (rect.bottom > window.innerHeight) {
				popup.style.top = (window.innerHeight - rect.height - 10) + "px";
			}
		});
	
		const removePopup = (e) => {
			if (!popup.contains(e.target)) {
				popup.remove();
				window.removeEventListener("mousedown", removePopup);
			}
		};
		window.addEventListener("mousedown", removePopup);
	}

	openFile(path) {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (file) {
			this.app.workspace.getLeaf(true).openFile(file);
		}
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

				dayCell.addEventListener("click", (evt) => {
					this.showDayPopup(evt, dateKey);
				});
			}
		}
	}

	async gatherFileActivity() {
		this.dailyFiles = {};
		const dailyCounts = {};
		const files = this.app.vault.getFiles();
		const folderPath = this.plugin.settings.targetFolder;

		for (const file of files) {
			if (!this.isInTargetFolder(file, folderPath)) continue;

			const cDate = moment(file.stat.ctime).startOf("day").format("YYYY-MM-DD");
			const mDate = moment(file.stat.mtime).startOf("day").format("YYYY-MM-DD");

			dailyCounts[cDate] = (dailyCounts[cDate] || 0) + 1;
			dailyCounts[mDate] = (dailyCounts[mDate] || 0) + 1;

			this.dailyFiles[cDate] = this.dailyFiles[cDate] || [];
			this.dailyFiles[mDate] = this.dailyFiles[mDate] || [];
			this.dailyFiles[cDate].push(file.path);
			this.dailyFiles[mDate].push(file.path);
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
				// Validate that each colour is a valid hex code (short or full form)
				presetColours = preset.colours.filter(c => 
					typeof c === "string" && /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(c)
				);
			}
		} catch (err) {
			console.error("Error parsing colourwaysPresetJSON:", err);
		}
		if (!presetColours.length) {
			// Fallback to default colours if no valid preset colours are found
			presetColours = ["#FF0000", "#FFA500", "#FFFF00", "#FF1493", "#FF00FF", "#FF4500"];
		}
		const index = Math.min(count - 1, presetColours.length - 1);
		return presetColours[index];
	}
}

/** ========== MAIN PLUGIN CLASS ========== */
module.exports = class HeatmapPlugin extends Plugin {
	async onload() {
// Removed unnecessary 		console logging per guidelines

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
		// Per guidelines, do not detach leaves on unload.
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
		const leaves = this.app.workspace.getLeavesOfType(HEATMAP_VIEW_TYPE);
		if (leaves.length) {
			const leaf = leaves[0]; // use first available heatmap leaf
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
