class SpecificationManager {
  constructor(options = {}) {
    this.specs = null;
    this.lastSyncTimestamp = null;
    
    this.useApi = options.useApi || false;
    this.apiBaseUrl = options.apiBaseUrl || '/api';
    // Default path assuming specifications.json is in public/data/
    this.localFilePath = options.localFilePath || '/data/specifications.json'; 
  }

  async initialize() {
    // Load specifications from local storage first
    const localSpecs = localStorage.getItem('specifications');
    if (localSpecs) {
      try {
        this.specs = JSON.parse(localSpecs);
        this.lastSyncTimestamp = localStorage.getItem('lastSyncTimestamp');
      } catch (error) {
        console.error("Error parsing specifications from localStorage:", error);
        localStorage.removeItem('specifications');
        localStorage.removeItem('lastSyncTimestamp');
      }
    }
    
    await this.syncSpecifications();
  }

  async syncSpecifications() {
    try {
      let needsUpdate = false;
      let newSpecs = null;
      let newTimestamp = null; // Use a different variable name for clarity
      
      if (this.useApi) {
        const versionResponse = await fetch(`${this.apiBaseUrl}/specifications/version`);
        if (!versionResponse.ok) throw new Error(`API version check failed: ${versionResponse.statusText}`);
        const versionData = await versionResponse.json();
        newTimestamp = versionData.timestamp;
        
        needsUpdate = !this.specs || !this.lastSyncTimestamp || newTimestamp > this.lastSyncTimestamp;
        
        if (needsUpdate) {
          const specsResponse = await fetch(`${this.apiBaseUrl}/specifications`);
          if (!specsResponse.ok) throw new Error(`API specs fetch failed: ${specsResponse.statusText}`);
          newSpecs = await specsResponse.json();
        }
      } else {
        const response = await fetch(this.localFilePath);
        if (!response.ok) {
          throw new Error(`Failed to fetch local specifications: ${response.statusText} from ${this.localFilePath}`);
        }
        newSpecs = await response.json();
        newTimestamp = newSpecs.metadata.lastUpdated;
        
        needsUpdate = !this.specs || 
                     !this.lastSyncTimestamp || 
                     new Date(newTimestamp) > new Date(this.lastSyncTimestamp || 0);
      }
      
      if (needsUpdate && newSpecs) {
        this.specs = newSpecs;
        this.lastSyncTimestamp = newTimestamp; // Use the fetched/parsed timestamp
        
        localStorage.setItem('specifications', JSON.stringify(this.specs));
        localStorage.setItem('lastSyncTimestamp', this.lastSyncTimestamp);
        
        console.log('Technical specifications updated to version:', this.specs.metadata.version);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to sync specifications:', error);
      return false;
    }
  }
  
  updateSettings(options = {}) {
    if ('useApi' in options) this.useApi = options.useApi;
    if ('apiBaseUrl' in options) this.apiBaseUrl = options.apiBaseUrl;
    if ('localFilePath' in options) this.localFilePath = options.localFilePath;
  }
  
  getItemsByCategory(category, subcategory = null) {
    if (!this.specs || !this.specs.categories) return [];
    
    const categoryData = this.specs.categories[category];
    if (!categoryData) return [];
    
    if (subcategory) {
      return categoryData[subcategory] || [];
    }
    
    return Object.values(categoryData).flat();
  }
  
  getItemById(id) {
    if (!this.specs || !this.specs.categories) return null;
    
    for (const categoryKey in this.specs.categories) {
      const category = this.specs.categories[categoryKey];
      for (const subCategoryKey in category) {
        const subcategoryItems = category[subCategoryKey];
        if (Array.isArray(subcategoryItems)) {
            const item = subcategoryItems.find(item => item.id === id);
            if (item) return item;
        }
      }
    }
    return null;
  }
  
  getChangeHistory(id) {
    const item = this.getItemById(id);
    if (!item) return [];
    
    let history = [];
    if (item.previousVersions && Array.isArray(item.previousVersions)) {
        history = [...item.previousVersions];
    }
    history.unshift({
        lastUpdated: item.lastUpdated, 
        changeNote: "Current version", 
        ...item 
    });
    return history.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
  }
  
  getRecentChanges(days = 30) {
    if (!this.specs || !this.specs.changeLog || !Array.isArray(this.specs.changeLog)) return [];
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return this.specs.changeLog.filter(change => {
      return new Date(change.date) >= cutoffDate;
    }).sort((a,b) => new Date(b.date) - new Date(a.date));
  }
}

export default SpecificationManager;