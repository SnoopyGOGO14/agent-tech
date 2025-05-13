import React, { useState, useEffect } from 'react';
import calendarFetcher from '../../utils/calendarFetcher'; // Adjusted path
import './EventIntegration.css';

/**
 * Component that handles matching budget calculator dates with calendar events
 */
function EventIntegration({ 
  selectedDate, 
  onEventConfirmed,
  onEventRejected,
  onCustomEventEntered
}) {
  const [eventStatus, setEventStatus] = useState({
    loading: false,
    checked: false,
    found: false,
    events: []
  });
  
  const [customEventTitle, setCustomEventTitle] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Check for matching events when the date changes
  useEffect(() => {
    if (!selectedDate) {
      setEventStatus({
        loading: false,
        checked: false,
        found: false,
        events: []
      });
      setShowCustomInput(false); // Also reset custom input view
      return;
    }
    
    // Look up events for the selected date
    async function checkForEvents() {
      setEventStatus({ loading: true, checked: false, found: false, events: [] }); // Reset and set loading
      setShowCustomInput(false); // Reset custom input view
      
      try {
        const result = await calendarFetcher.getEventForDate(selectedDate);
        
        if (result.found) {
          setEventStatus({
            loading: false,
            checked: true,
            found: true,
            exact: result.exact,
            events: result.exact ? [result.event] : result.events
          });
        } else {
          // No events found
          setEventStatus({
            loading: false,
            checked: true,
            found: false,
            events: [],
            message: result.message // Store message for display
          });
        }
      } catch (error) {
        console.error('Error checking for events:', error);
        setEventStatus({
          loading: false,
          checked: true,
          found: false,
          events: [],
          error: true,
          message: 'Error fetching event information' // Store error message
        });
      }
    }
    
    checkForEvents();
  }, [selectedDate]);

  // Handle confirming an event selection
  const handleConfirmEvent = (event) => {
    onEventConfirmed(event);
    // Reset state to hide this component or be ready for new date
    setEventStatus(prev => ({ ...prev, checked: false, found: false, events: [] })); 
    setShowCustomInput(false);
  };

  // Handle rejecting all suggested events
  const handleRejectEvents = () => {
    setShowCustomInput(true);
    if (onEventRejected) {
        onEventRejected(); // Call if provided
    }
  };

  // Handle submitting a custom event title
  const handleCustomEventSubmit = (e) => {
    e.preventDefault();
    
    if (customEventTitle.trim() === '') return;
    
    const customEvent = {
      title: customEventTitle,
      date: selectedDate,
      isCustom: true
      // Add other fields like rawDateText, time if needed for consistency
    };
    
    onCustomEventEntered(customEvent);
    
    // Reset state
    setCustomEventTitle('');
    setShowCustomInput(false);
    setEventStatus(prev => ({ ...prev, checked: false, found: false, events: [] })); 
  };

  // If no date is selected or we haven't checked yet (and not loading), show nothing
  if (!selectedDate || (!eventStatus.checked && !eventStatus.loading)) {
    return null;
  }

  // Show event confirmation UI
  return (
    <div className="event-integration">
      {eventStatus.loading ? (
        <div className="event-loading">
          <p>Checking calendar for events on {selectedDate}...</p>
        </div>
      ) : eventStatus.checked && eventStatus.found ? (
        <div className="event-confirmation">
          <h3>
            {eventStatus.exact 
              ? 'Event found for selected date:' 
              : 'Events found near selected date:'}
          </h3>
          
          <ul className="event-list">
            {eventStatus.events.map((event, index) => (
              <li key={index} className="event-item">
                <div className="event-details">
                  <h4>{event.title}</h4>
                  <p className="event-date">
                    {event.rawDateText || event.date} {event.time && `• ${event.time}`}
                  </p>
                  {event.description && (
                    <p className="event-description">{event.description}</p>
                  )}
                </div>
                <button 
                  className="confirm-button"
                  onClick={() => handleConfirmEvent(event)}
                >
                  This is my event
                </button>
              </li>
            ))}
          </ul>
          
          {!showCustomInput && (
            <button className="reject-button" onClick={handleRejectEvents}>
              None of these are my event
            </button>
          )}
        </div>
      ) : eventStatus.checked && showCustomInput ? (
        <div className="custom-event-form">
          <h3>Enter your event information for {selectedDate}:</h3>
          <form onSubmit={handleCustomEventSubmit}>
            <input
              type="text"
              value={customEventTitle}
              onChange={(e) => setCustomEventTitle(e.target.value)}
              placeholder="Enter event title"
              required
            />
            <button type="submit">Use this title</button>
          </form>
        </div>
      ) : eventStatus.checked && !eventStatus.found && !showCustomInput ? (
        <div className="no-events-found">
          <p>{eventStatus.message || `No events found for ${selectedDate}.`}</p>
          <button 
            className="custom-event-button"
            onClick={() => setShowCustomInput(true)}
          >
            Enter event manually
          </button>
        </div>
      ) : null}
      {eventStatus.error && <p className="error-message">{eventStatus.message}</p>}
    </div>
  );
}

export default EventIntegration;