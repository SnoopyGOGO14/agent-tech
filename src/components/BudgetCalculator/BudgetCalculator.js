import React, { useState, useEffect } from 'react';
import EventIntegration from './EventIntegration'; // Assuming it's in the same directory
// We will get equipment data via props or a passed-in manager now
// import equipmentData from '../../data/equipment.json'; 
import './BudgetCalculator.css';

// Function to get SpecificationManager - to be provided by App.js or similar
// This is a placeholder concept; actual implementation will depend on how specManager is made available.
let getSpecManager = () => null; 
export const setSpecificationManagerRetriever = (retriever) => {
  getSpecManager = retriever;
};

function BudgetCalculator() {
  const [allEquipment, setAllEquipment] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [itemsForCategory, setItemsForCategory] = useState([]); // Renamed from 'items' for clarity
  const [selectedItems, setSelectedItems] = useState([]);
  const [subtotal, setSubtotal] = useState(0);
  const [vat, setVat] = useState(0);
  const [total, setTotal] = useState(0);
  
  const [eventDate, setEventDate] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventIntegration, setShowEventIntegration] = useState(false);

  // Initialize categories and all equipment from SpecificationManager
  useEffect(() => {
    const specManager = getSpecManager();
    if (specManager && specManager.specs) {
      const equipCategories = Object.keys(specManager.specs.categories || {});
      setCategories(equipCategories);
      
      let allEquip = [];
      equipCategories.forEach(catKey => {
        const subCategories = specManager.specs.categories[catKey];
        Object.keys(subCategories).forEach(subCatKey => {
          if (Array.isArray(subCategories[subCatKey])) {
            // Add category and subcategory info for display and filtering if needed
            const itemsWithFullCategory = subCategories[subCatKey].map(item => ({
              ...item,
              fullCategory: `${catKey} > ${subCatKey}`,
              hireFee: item.cost // Adapt to new data structure
            }));
            allEquip = [...allEquip, ...itemsWithFullCategory];
          }
        });
      });
      setAllEquipment(allEquip);
    } else {
      // Fallback or error handling if specManager isn't ready or has no specs
      console.warn("SpecificationManager not ready or has no specs. BudgetCalculator may not have equipment data.");
      // You might want to load from a static equipment.json as a further fallback if needed
    }
  }, []); // Runs once on mount, assuming specManager is initialized by then by App.js

  // Update available items when category changes
  useEffect(() => {
    if (selectedCategory && allEquipment.length > 0) {
      // Filter items based on the main category key (e.g., "SOUND", "LIGHTING")
      const categoryItems = allEquipment.filter(
        item => item.fullCategory.startsWith(selectedCategory)
      );
      setItemsForCategory(categoryItems);
    } else {
      setItemsForCategory([]);
    }
  }, [selectedCategory, allEquipment]);

  // Calculate totals when selected items change
  useEffect(() => {
    const subTotal = selectedItems.reduce((sum, item) => sum + (item.hireFee || item.cost || 0), 0);
    const vatAmount = subTotal * 0.2; // 20% VAT
    
    setSubtotal(subTotal);
    setVat(vatAmount);
    setTotal(subTotal + vatAmount);
  }, [selectedItems]);

  const handleAddItem = (item) => {
    setSelectedItems([...selectedItems, item]);
  };
  
  const handleRemoveItem = (index) => {
    const newItems = [...selectedItems];
    newItems.splice(index, 1);
    setSelectedItems(newItems);
  };
  
  const handleDateChange = (e) => {
    const date = e.target.value;
    setEventDate(date);
    
    if (date) {
      setShowEventIntegration(true);
      setSelectedEvent(null); // Reset selected event when date changes
    } else {
      setShowEventIntegration(false);
      setSelectedEvent(null);
    }
  };
  
  const handleEventConfirmed = (event) => {
    setSelectedEvent(event);
    setShowEventIntegration(false);
  };
  
  const handleEventRejected = () => {
    // Keep the event integration UI open for custom entry
    // No explicit action needed here if custom entry is handled by EventIntegration component
  };
  
  const handleCustomEventEntered = (customEvent) => {
    setSelectedEvent(customEvent);
    setShowEventIntegration(false);
  };
  
  return (
    <div className="budget-calculator">
      <h2>Equipment Budget Calculator</h2>
      
      <div className="event-selection-area">
        <h3>Event Information</h3>
        <div className="date-picker">
          <label htmlFor="event-date">Event Date:</label>
          <input
            type="date"
            id="event-date"
            value={eventDate}
            onChange={handleDateChange}
          />
        </div>
        
        {selectedEvent && !showEventIntegration && (
          <div className="selected-event-display">
            <h4>Selected Event:</h4>
            <p className="event-title-display">{selectedEvent.title}</p>
            <p className="event-date-display">
              {selectedEvent.rawDateText || selectedEvent.date}
              {selectedEvent.time && ` • ${selectedEvent.time}`}
            </p>
            {selectedEvent.description && (
              <p className="event-description-display">{selectedEvent.description}</p>
            )}
            <button 
              className="change-event-button"
              onClick={() => {
                setShowEventIntegration(true); 
                // Optionally clear selectedEvent if you want EventIntegration to restart fresh
                // setSelectedEvent(null); 
              }}
            >
              Change Event Details
            </button>
          </div>
        )}
        
        {showEventIntegration && (
          <EventIntegration
            selectedDate={eventDate}
            onEventConfirmed={handleEventConfirmed}
            onEventRejected={handleEventRejected}
            onCustomEventEntered={handleCustomEventEntered}
          />
        )}
      </div>
      
      <div className="calculator-container">
        <div className="equipment-selection">
          <h3>Select Equipment</h3>
          
          <div className="category-selection">
            <label htmlFor="category-select">Category:</label>
            <select 
              id="category-select"
              value={selectedCategory} 
              onChange={(e) => setSelectedCategory(e.target.value)}
              disabled={!eventDate || showEventIntegration} // Disable if no date or if confirming event
            >
              <option value="">Select a category</option>
              {categories.map(cat => (
                // Using main category keys like SOUND, LIGHTING
                <option key={cat} value={cat}>{cat.replace('_', ' ').toUpperCase()}</option>
              ))}
            </select>
          </div>
          
          {itemsForCategory.length > 0 && (
            <div className="item-list">
              <h4>Available Items in {selectedCategory.replace('_', ' ').toUpperCase() || 'Selected Category'}</h4>
              <ul>
                {itemsForCategory.map(item => (
                  <li key={item.id}>
                    <div className="item-details">
                      <strong>{item.name}</strong>
                      {item.specifications && <p className="item-spec">Specs: {item.specifications}</p>}
                      {item.description && <p className="item-desc">{item.description}</p>}
                      <span>£{(item.hireFee || item.cost || 0).toFixed(2)} per day</span>
                    </div>
                    <button onClick={() => handleAddItem(item)}>Add</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        <div className="selected-equipment">
          <h3>Your Equipment Selection</h3>
          
          {selectedItems.length > 0 ? (
            <>
              <ul className="selection-list">
                {selectedItems.map((item, index) => (
                  <li key={index}>
                    <div className="item-details">
                      <strong>{item.name}</strong>
                      <span>£{(item.hireFee || item.cost || 0).toFixed(2)}</span>
                    </div>
                    <button 
                      className="remove"
                      onClick={() => handleRemoveItem(index)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              
              <div className="cost-summary">
                <div className="cost-line">
                  <span>Subtotal:</span>
                  <span>£{subtotal.toFixed(2)}</span>
                </div>
                <div className="cost-line">
                  <span>VAT (20%):</span>
                  <span>£{vat.toFixed(2)}</span>
                </div>
                <div className="cost-line total">
                  <span>Total (inc. VAT):</span>
                  <span>£{total.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="quote-details">
                {selectedEvent && (
                  <div className="quote-event-info">
                    <p><strong>Event:</strong> {selectedEvent.title}</p>
                    <p><strong>Date:</strong> {selectedEvent.rawDateText || selectedEvent.date}</p>
                  </div>
                )}
                <button className="print-button">Print Quote</button>
              </div>
            </>
          ) : (
            <p className="empty-selection">
              {eventDate ? 'No equipment selected. Choose items from the left panel.' : 'Please select an event date first.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default BudgetCalculator;