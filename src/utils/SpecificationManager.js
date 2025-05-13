class SpecificationManager {
  constructor(options = {}) {
    this.specs = null;
    this.lastSyncTimestamp = null;
    
    // Default to local file mode, but can be configured
    this.useApi = options.useApi || false;
    this.apiBaseUrl = options.apiBaseUrl || '/api';
    this.localFilePath = options.localFilePath || './data/specifications.json'; // Adjusted path
  }

  async initialize() {
    // Load specifications from local storage first
    const localSpecs = localStorage.getItem('specifications');
    if (localSpecs) {
      this.specs = JSON.parse(localSpecs);
      this.lastSyncTimestamp = localStorage.getItem('lastSyncTimestamp');
    }
    
    // Then check for updates
    await this.syncSpecifications();
  }

  async syncSpecifications() {
    try {
      let needsUpdate = false;
      let newSpecs = null;
      let timestamp = null;
      
      if (this.useApi) {
        // API approach
        const versionResponse = await fetch(`${this.apiBaseUrl}/specifications/version`);
        const versionData = await versionResponse.json();
        timestamp = versionData.timestamp;
        
        // Check if we need to update
        needsUpdate = !this.specs || !this.lastSyncTimestamp || timestamp > this.lastSyncTimestamp;
        
        if (needsUpdate) {
          const specsResponse = await fetch(`${this.apiBaseUrl}/specifications`);
          newSpecs = await specsResponse.json();
        }
      } else {
        // Local file approach
        // Ensure the path is relative to where it might be called from or use an absolute-like path from root
        const response = await fetch(this.localFilePath); 
        if (!response.ok) {
          throw new Error(`Failed to fetch local specifications: ${response.statusText} from ${this.localFilePath}`);
        }
        newSpecs = await response.json();
        timestamp = newSpecs.metadata.lastUpdated;
        
        // Check if we need to update
        needsUpdate = !this.specs || 
                     !this.lastSyncTimestamp || 
                     new Date(timestamp) > new Date(this.lastSyncTimestamp || 0); // Ensure lastSyncTimestamp is valid for Date
      }
      
      if (needsUpdate && newSpecs) {
        this.specs = newSpecs;
        this.lastSyncTimestamp = timestamp;
        
        // Save to local storage for offline access
        localStorage.setItem('specifications', JSON.stringify(this.specs));
        localStorage.setItem('lastSyncTimestamp', timestamp);
        
        console.log('Technical specifications updated to version:', newSpecs.metadata.version);
        return true; // Indicates an update occurred
      }
      
      return false; // No update needed
    } catch (error) {
      console.error('Failed to sync specifications:', error);
      // Continue using cached specs if available
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
    
    // Flatten all subcategories into one array if no specific subcategory is requested
    return Object.values(categoryData).flat();
  }
  
  getItemById(id) {
    if (!this.specs || !this.specs.categories) return null;
    
    // Search through all categories and subcategories
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
    
    // Combine current version with previous versions
    // The 'current state' part is conceptual; actual changes should be logged in previousVersions
    let history = [];
    if (item.previousVersions && Array.isArray(item.previousVersions)) {
        history = [...item.previousVersions];
    }
    // Add the current state as the most recent record if it makes sense for display
    // This assumes lastUpdated and other relevant fields represent the current "version" of the item itself
    history.unshift({
        // lastUpdated might be the timestamp, changeNote for what changed to this state if available
        lastUpdated: item.lastUpdated, 
        changeNote: "Current version", // Or derive this from comparison if needed
        // Include all current details of the item to represent its state at item.lastUpdated
        ...item 
    });
    return history.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated)); // Ensure newest first
  }
  
  getRecentChanges(days = 30) {
    if (!this.specs || !this.specs.changeLog || !Array.isArray(this.specs.changeLog)) return [];
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return this.specs.changeLog.filter(change => {
      return new Date(change.date) >= cutoffDate;
    }).sort((a,b) => new Date(b.date) - new Date(a.date)); // Ensure newest first
  }
}

export default SpecificationManager;