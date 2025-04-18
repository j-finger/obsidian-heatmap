const {
	App,
	Plugin,
	PluginSettingTab,
	Setting,
	ItemView,
	moment,
	setIcon,
	normalizePath,
	TFolder 
} = require("obsidian");

/** ========== GLOBAL CONSTANTS ========== */

const HEATMAP_VIEW_TYPE = "heatmap-view";
const DEFAULT_HEATMAP_LEAF_ICON = "activity";
const DEFAULT_HEATMAP_LEAF_TITLE = "Vault Heatmap";
const REFRESH_INTERVAL_MS = 1000 * 60 * 60;

/** ========== SETTINGS ========== */

const DEFAULT_SETTINGS = {
    trackedFolderPath: "",
    colourPresetsJSON: JSON.stringify([
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
    heatmapLeafTitle: "Vault Heatmap",
    heatmapLeafIcon: "activity"
};

class HeatmapSettingsTab extends PluginSettingTab {
	constructor(app, plugin) {
		super(app, plugin);
		this.plugin = plugin;
	}
	isValidFolder(folderPath) {
		if (!folderPath.trim()) return true;
		const file = this.app.vault.getAbstractFileByPath(folderPath.trim());
		return file && file instanceof TFolder;
	}

	isValidIcon(iconName) {
		return iconName.trim().length > 0;
	}

	display() {
		const { containerEl } = this;
		
		containerEl.empty();

		/** -- Target Folder Setting -- */
		new Setting(containerEl)
			.setName("Target folder")
			.setDesc("Track only files in this folder (and subfolders). Leave blank for entire vault.")
			.addText((text) => {
				text
					.setPlaceholder("e.g. folderA/Subfolder")
					.setValue(this.plugin.settings.trackedFolderPath)
					.onChange(async (value) => {
						let normalizedFolder = normalizePath(value.trim());
						this.plugin.settings.trackedFolderPath = normalizedFolder;
						if (!this.isValidFolder(normalizedFolder)) {
							text.inputEl.classList.add("invalid-input");
						} else {
							text.inputEl.classList.remove("invalid-input");
						}
						await this.plugin.saveSettings();
						this.plugin.refreshHeatmapView();
					});
				let normalizedFolder = normalizePath(this.plugin.settings.trackedFolderPath);
				if (!this.isValidFolder(normalizedFolder)) {
					text.inputEl.classList.add("invalid-input");
				}
				});
		
		/** -- Leaf Name Setting -- */
		new Setting(containerEl)
			.setName("Leaf name")
			.setDesc("Custom name used for the heatmap leaf title, panel tooltip, etc.")
			.addText((text) =>
				text
					.setPlaceholder("Heatmap")
					.setValue(this.plugin.settings.heatmapLeafTitle)
					.onChange(async (value) => {
						this.plugin.settings.heatmapLeafTitle = value.trim();
						await this.plugin.saveSettings();
						this.plugin.refreshHeatmapView();
					})
				);
		
		/** -- Leaf Icon Setting -- */
		const iconSetting = new Setting(containerEl)
			.setName("Leaf icon")
			.setDesc("Loading...")
			.addText((text) => {
				text
					.setPlaceholder(DEFAULT_HEATMAP_LEAF_ICON)
					.setValue(this.plugin.settings.heatmapLeafIcon)
					.onChange(async (value) => {
						this.plugin.settings.heatmapLeafIcon = value.trim();
						if (!this.isValidIcon(this.plugin.settings.heatmapLeafIcon)) {
							text.inputEl.classList.add("invalid-input");
						} else {
							text.inputEl.classList.remove("invalid-input");
						}
						await this.plugin.saveSettings();
						this.plugin.refreshHeatmapView();
					});
				if (!this.isValidIcon(this.plugin.settings.heatmapLeafIcon)) {
					text.inputEl.classList.add("invalid-input");
				}
			});
		iconSetting.descEl.empty();
		iconSetting.descEl.createEl("span", { text: "Type the exact " });
		const link = iconSetting.descEl.createEl("a", { text: "Lucide icon" });
		link.href = "https://lucide.dev/icons/";
		link.target = "_blank";
		link.rel = "noopener";
		iconSetting.descEl.createEl("span", { text: " name" });
		
		/** -- Actions Setting -- */
		const buttonSetting = new Setting(containerEl)
			.setName("Actions")
			.setDesc("Apply or reset the settings.");
		buttonSetting.addButton((btn) => {
			btn.setButtonText("Apply changes")
				.setCta()
				.onClick(async () => {
					await this.plugin.saveSettings();
					this.plugin.updateActiveLeaf({
						title: this.plugin.settings.heatmapLeafTitle,
						icon: this.plugin.settings.heatmapLeafIcon
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
		
		/** -- Colour Settings Section -- */
		new Setting(containerEl).setHeading("Colour");

		new Setting(containerEl)
			.setName("Colourways presets json")
			.setDesc("Define the colourways (each as an object with a 'name' and 'colours' array). Best edited in a code editor.")
			.addTextArea((textArea) => {
				textArea
					.setPlaceholder('e.g. [{"name": "Warm", "colours": ["#FF0000", "#FFA500", ...]}]')
					.setValue(this.plugin.settings.colourPresetsJSON)
					.onChange(async (value) => {
						this.plugin.settings.colourPresetsJSON = value.trim();
						await this.plugin.saveSettings();
						this.display();
						this.plugin.refreshHeatmapView();
					});
				textArea.inputEl.classList.add("settings-input-text-area");
			});

		let presetOptions = {};
		try {
			const presets = JSON.parse(this.plugin.settings.colourPresetsJSON);
			presets.forEach((preset) => {
				if (preset.name) presetOptions[preset.name] = preset.name;
			});
		} catch (error) {
			presetOptions["Natural"] = "Natural";
		}

		new Setting(containerEl)
			.setName("Select colourway")
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
// const HEATMAP_VIEW_TYPE = "heatmap-view";

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
		return this.plugin.settings.heatmapLeafTitle || DEFAULT_HEATMAP_LEAF_TITLE;
	}
	getIcon() {
		return this.plugin.settings.heatmapLeafIcon || DEFAULT_HEATMAP_LEAF_ICON;
	}

	/** ========== VIEW INITIALIZATION ========== */
	async onOpen() {
		this.containerEl.empty();
		if (this.leaf && this.leaf.tabHeaderInnerEl) {
			setIcon(this.leaf.tabHeaderInnerEl, this.plugin.settings.heatmapLeafIcon || DEFAULT_HEATMAP_LEAF_ICON);
		}
		this.containerEl.classList.add("heatmap-default-padding");
		this.heatmapContainer = this.containerEl.createDiv({ cls: "heatmap-container" });
		this.gridEl = this.heatmapContainer.createDiv({ cls: "heatmap-grid" });
		this.dailyCounts = await this.gatherFileActivity();
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
				if (Math.abs(w - this.lastWidth) >= 2) {
					this.buildHeatmap(w);
					this.lastWidth = w;
				}
			}
		});
		this.resizeObserver.observe(this.heatmapContainer);
		const initialWidth = this.heatmapContainer.offsetWidth;
		this.buildHeatmap(initialWidth);
		this.lastWidth = initialWidth;
	}

	/** ========== HEATMAP GRID BUILDING ========== */
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
		// cDate and mDate store creation and modification days. dailyCounts tallies file activity per date.
		this.dailyFiles = {};
		const dailyCounts = {};
		const files = this.app.vault.getFiles();
		const folderPath = this.plugin.settings.trackedFolderPath;

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
		// Creates and positions a small popup of file names for dateKey, and dismisses it if clicked outside.
		document.querySelectorAll(".day-popup").forEach(el => el.remove());
	
		const filesForDate = this.dailyFiles?.[dateKey] || [];
		if (!filesForDate.length) return;
	
		const popup = createDiv({ cls: "day-popup" });
		popup.style.position = "absolute";
		popup.style.left = evt.pageX + "px";
		popup.style.top = evt.pageY + "px";
		popup.style.zIndex = 9999;
	
		filesForDate.forEach(path => {
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

	isInTargetFolder(file, folderPath) {
		// Checks whether folderPath is empty or if file path starts with folderPath (case-insensitive).
		if (!folderPath) return true;
		return file.path.toLowerCase().startsWith(folderPath.toLowerCase() + "/");
	}

	getColor(count) {
		if (count === 0) return "#ebedf0";
		let presetColours = [];
		try {
			let presets = JSON.parse(this.plugin.settings.colourPresetsJSON);
			let preset = presets.find(p => p.name === this.plugin.settings.selectedColourway);
			if (preset && Array.isArray(preset.colours)) {
				presetColours = preset.colours.filter(c => 
					typeof c === "string" && /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(c)
				);
			}
		} catch (err) {
			console.error("Error parsing colourPresetsJSON:", err);
		}
		if (!presetColours.length) {
			presetColours = ["#d9ed92", "#b5e48c", "#99d98c", "#76c893", "#52b69a", "#34a0a4", "#168aad", "#1a759f", "#1e6091", "#184e77"];
		}
		const index = Math.min(count - 1, presetColours.length - 1);
		return presetColours[index];
	}
}

/** ========== MAIN PLUGIN CLASS ========== */
module.exports = class HeatmapPlugin extends Plugin {
	async onload() {

		await this.loadSettings();
		this.registerView(
			HEATMAP_VIEW_TYPE,
			(leaf) => new HeatmapView(leaf, this)
		);
		this.addSettingTab(new HeatmapSettingsTab(this.app, this));
		this.addCommand({
			id: "reopen-heatmap-pane",
			name: "Reopen Heatmap Pane",
			callback: () => {
				this.activateView();
			}
		});
		this.lastDateChecked = new Date().toDateString();
    	this.registerInterval(window.setInterval(() => {
			const currentDate = new Date().toDateString();
			if (currentDate !== this.lastDateChecked) {
				this.lastDateChecked = currentDate;
				this.refreshHeatmapView();
			}
		}, REFRESH_INTERVAL_MS));
		this.activateView();
	}

	onunload() {
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
			const leaf = leaves[0];
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
