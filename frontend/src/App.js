import React, { useState, useEffect } from 'react';
import { format, parseISO, addWeeks, subWeeks, addDays, startOfWeek, endOfWeek, addMonths, getDay } from 'date-fns';
import { nb } from 'date-fns/locale';
import './App.css';

// API utility functions
const API_BASE = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const apiCall = async (endpoint, options = {}) => {
  try {
    const response = await fetch(`${API_BASE}/api${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API call error:', error);
    throw error;
  }
};

// Service types configuration
const SERVICE_TYPES = [
  { id: 'gudstjeneste', name: 'Gudstjeneste', color: 'service-gudstjeneste' },
  { id: 'vielse', name: 'Vielse', color: 'service-vielse' },
  { id: 'konsert', name: 'Konsert', color: 'service-konsert' },
  { id: 'annet', name: 'Annet', color: 'service-annet' },
  { id: 'vikartjeneste', name: 'Vikartjeneste', color: 'service-vikartjeneste' }
];

// Absence types configuration
const ABSENCE_TYPES = [
  { id: 'frihelg', name: 'Frihelg', color: 'absence-frihelg' },
  { id: 'avspasering', name: 'Avspasering', color: 'absence-avspasering' },
  { id: 'sykemelding', name: 'Sykemelding', color: 'absence-sykemelding' },
  { id: 'ferie', name: 'Ferie', color: 'absence-ferie' }
];

function App() {
  // State management
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [compactMode, setCompactMode] = useState(false);
  const [calendarData, setCalendarData] = useState({
    services: [],
    absences: [],
    employees: [],
    churches: [],
    date_range: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [inboxWidth, setInboxWidth] = useState(170);

  // Modal states
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [showChurchModal, setShowChurchModal] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  
  // Current editing states
  const [currentService, setCurrentService] = useState(null);
  const [currentAbsence, setCurrentAbsence] = useState(null);
  const [pendingDrop, setPendingDrop] = useState(null);

  // Initialize date range (1 week by default)
  useEffect(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
    const end = endOfWeek(start, { weekStartsOn: 1 }); // Sunday
    
    setDateRange({
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd')
    });
  }, [currentDate]);

  // Fetch calendar data when date range changes
  useEffect(() => {
    if (dateRange.start && dateRange.end) {
      fetchCalendarData();
    }
  }, [dateRange, compactMode]);

  const fetchCalendarData = async () => {
    try {
      setLoading(true);
      const data = await apiCall('/calendar', {
        method: 'POST',
        body: JSON.stringify({
          start_date: dateRange.start,
          end_date: dateRange.end,
          compact_mode: compactMode
        })
      });
      setCalendarData(data);
      setError(null);
    } catch (err) {
      setError('Feil ved lasting av kalenderdata: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Date range quick filters
  const setQuickFilter = (type) => {
    let start, end;
    const today = new Date();

    switch (type) {
      case '1week':
        start = startOfWeek(today, { weekStartsOn: 1 });
        end = endOfWeek(start, { weekStartsOn: 1 });
        break;
      case '2weeks':
        start = startOfWeek(today, { weekStartsOn: 1 });
        end = endOfWeek(addWeeks(start, 1), { weekStartsOn: 1 });
        break;
      case '3weeks':
        start = startOfWeek(today, { weekStartsOn: 1 });
        end = endOfWeek(addWeeks(start, 2), { weekStartsOn: 1 });
        break;
      case '1month':
        start = startOfWeek(today, { weekStartsOn: 1 });
        end = endOfWeek(addMonths(start, 1), { weekStartsOn: 1 });
        break;
      case '2months':
        start = startOfWeek(today, { weekStartsOn: 1 });
        end = endOfWeek(addMonths(start, 2), { weekStartsOn: 1 });
        break;
      case '3months':
        start = startOfWeek(today, { weekStartsOn: 1 });
        end = endOfWeek(addMonths(start, 3), { weekStartsOn: 1 });
        break;
      default:
        return;
    }

    setDateRange({
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd')
    });
    setCurrentDate(start);
  };

  // Week navigation
  const navigateWeek = (direction) => {
    const newDate = direction === 'next' ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1);
    setCurrentDate(newDate);
  };

  // Get weekend class for date
  const getWeekendClass = (dateStr) => {
    const dayOfWeek = getDay(parseISO(dateStr));
    if (dayOfWeek === 6) return 'weekend-saturday'; // Saturday
    if (dayOfWeek === 0) return 'weekend-sunday';   // Sunday
    return '';
  };

  // Get events for specific date and employee
  const getEventsForCell = (date, employeeId = null) => {
    const services = calendarData.services.filter(service => 
      service.date === date && service.employee_id === employeeId
    );
    
    const absences = calendarData.absences.filter(absence =>
      absence.employee_id === employeeId &&
      absence.start_date <= date && 
      absence.end_date >= date
    );

    return { services, absences };
  };

  // Render event card
  const renderEventCard = (event, type) => {
    const baseClass = `event-card ${type === 'service' ? SERVICE_TYPES.find(t => t.id === event.type)?.color : ABSENCE_TYPES.find(t => t.id === event.type)?.color}`;
    
    if (type === 'service') {
      const church = calendarData.churches.find(c => c.id === event.church_id);
      return (
        <div 
          key={event.id} 
          className={baseClass}
          onClick={() => {
            setCurrentService(event);
            setShowServiceModal(true);
          }}
        >
          <div className="event-time">{event.time}</div>
          <div className="event-church">{church?.name || 'Ukjent kirke'}</div>
          {event.notes && <div className="event-notes">{event.notes}</div>}
        </div>
      );
    } else {
      return (
        <div 
          key={event.id} 
          className={baseClass}
          onClick={() => {
            setCurrentAbsence(event);
            setShowAbsenceModal(true);
          }}
        >
          <div>{ABSENCE_TYPES.find(t => t.id === event.type)?.name}</div>
        </div>
      );
    }
  };

  // Create new employee
  const addEmployee = async (name) => {
    if (!name.trim()) return;
    
    try {
      await apiCall('/employees', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          position: calendarData.employees.length
        })
      });
      fetchCalendarData();
    } catch (err) {
      setError('Feil ved opprettelse av ansatt: ' + err.message);
    }
  };

  // Update employee name
  const updateEmployeeName = async (employeeId, newName) => {
    if (!newName.trim()) return;
    
    try {
      await apiCall(`/employees/${employeeId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: newName.trim() })
      });
      fetchCalendarData();
    } catch (err) {
      setError('Feil ved oppdatering av ansatt: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Laster kalenderdata...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600 text-center">
          <div className="text-lg font-semibold mb-2">Feil oppstod</div>
          <div>{error}</div>
          <button 
            onClick={fetchCalendarData}
            className="btn btn-primary mt-4"
          >
            Prøv igjen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with controls */}
      <div className="bg-white shadow-sm border-b p-4">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-900">Kirkespor arbeidsplan</h1>
          
          {/* Time filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Tidsfilter:</span>
              <button onClick={() => setQuickFilter('1week')} className="btn btn-secondary text-xs">1 uke</button>
              <button onClick={() => setQuickFilter('2weeks')} className="btn btn-secondary text-xs">2 uker</button>
              <button onClick={() => setQuickFilter('3weeks')} className="btn btn-secondary text-xs">3 uker</button>
              <button onClick={() => setQuickFilter('1month')} className="btn btn-secondary text-xs">1 måned</button>
              <button onClick={() => setQuickFilter('2months')} className="btn btn-secondary text-xs">2 måneder</button>
              <button onClick={() => setQuickFilter('3months')} className="btn btn-secondary text-xs">3 måneder</button>
            </div>
            
            <div className="flex items-center gap-2">
              <button onClick={() => navigateWeek('prev')} className="btn btn-secondary text-xs">← Forrige uke</button>
              <button onClick={() => navigateWeek('next')} className="btn btn-secondary text-xs">Neste uke →</button>
            </div>
            
            <label className="flex items-center gap-2">
              <input 
                type="checkbox" 
                checked={compactMode}
                onChange={(e) => setCompactMode(e.target.checked)}
              />
              <span className="text-sm">Kompakt kalender</span>
            </label>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button className="btn btn-primary text-sm">📄 Eksporter til PDF</button>
            <button onClick={() => setShowBackupModal(true)} className="btn btn-secondary text-sm">💾 Backup</button>
            <button onClick={() => setShowChurchModal(true)} className="btn btn-secondary text-sm">⛪ Kirker</button>
          </div>
        </div>
        
        {/* Current date range */}
        <div className="mt-2 text-sm text-gray-600">
          Fra {format(parseISO(dateRange.start), 'dd.MM.yyyy', { locale: nb })} til {format(parseISO(dateRange.end), 'dd.MM.yyyy', { locale: nb })}
        </div>
      </div>

      <div className="flex">
        {/* Left sidebar with toolboxes */}
        <div className="w-80 p-4 bg-gray-50 border-r overflow-y-auto">
          {/* Services toolbox */}
          <div className="toolbox">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              🛠️ Tjenester
              <button className="text-xs text-blue-600">+ Ny type</button>
            </h3>
            {SERVICE_TYPES.map(serviceType => (
              <div 
                key={serviceType.id}
                className={`toolbox-item ${serviceType.color}`}
                draggable
              >
                {serviceType.name}
              </div>
            ))}
          </div>

          {/* Absences toolbox */}
          <div className="toolbox">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              🏖️ Fravær
              <button className="text-xs text-blue-600">+ Ny type</button>
            </h3>
            {ABSENCE_TYPES.map(absenceType => (
              <div 
                key={absenceType.id}
                className={`toolbox-item ${absenceType.color}`}
                draggable
              >
                {absenceType.name}
              </div>
            ))}
          </div>
          
          <div className="text-xs text-gray-500 mt-4">
            Dra og slipp sant til endre bredde på INNBOKS for å endre bredde på alle kolonner
          </div>
        </div>

        {/* Main calendar grid */}
        <div className="flex-1 overflow-auto">
          <div className="calendar-grid" style={{ gridTemplateColumns: `auto ${inboxWidth}px repeat(${calendarData.employees.length + 1}, ${inboxWidth}px)` }}>
            {/* Header row */}
            <div className="calendar-cell date-cell bg-gray-100 font-bold sticky top-0 z-10">
              DATO
            </div>
            <div className="calendar-cell bg-gray-100 font-bold sticky top-0 z-10 relative">
              <div className="flex items-center justify-between px-2">
                INNBOKS
                <div className="resize-handle"></div>
              </div>
            </div>
            
            {calendarData.employees.map((employee) => (
              <div key={employee.id} className="calendar-cell bg-gray-100 font-bold sticky top-0 z-10">
                <input 
                  type="text" 
                  value={employee.name}
                  className="w-full bg-transparent text-center font-bold"
                  onChange={(e) => updateEmployeeName(employee.id, e.target.value)}
                  onBlur={(e) => updateEmployeeName(employee.id, e.target.value)}
                />
              </div>
            ))}
            
            {/* New employee column */}
            <div className="calendar-cell bg-gray-100 font-bold sticky top-0 z-10">
              <input 
                type="text" 
                placeholder="+ Legg til ansatt"
                className="w-full bg-transparent text-center font-bold placeholder-gray-400"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && e.target.value.trim()) {
                    addEmployee(e.target.value);
                    e.target.value = '';
                  }
                }}
              />
            </div>

            {/* Calendar rows */}
            {calendarData.date_range.map((date) => (
              <React.Fragment key={date}>
                {/* Date cell */}
                <div className={`calendar-cell date-cell ${getWeekendClass(date)}`}>
                  <div className="text-center">
                    <div className="text-sm font-bold">
                      {format(parseISO(date), 'dd', { locale: nb })}
                    </div>
                    <div className="text-xs">
                      {format(parseISO(date), 'EEE', { locale: nb })}
                    </div>
                  </div>
                </div>

                {/* Inbox cell */}
                <div className={`calendar-cell drop-zone ${getWeekendClass(date)}`}>
                  {getEventsForCell(date, null).services.map(service => 
                    renderEventCard(service, 'service')
                  )}
                </div>

                {/* Employee cells */}
                {calendarData.employees.map((employee) => {
                  const { services, absences } = getEventsForCell(date, employee.id);
                  return (
                    <div key={employee.id} className={`calendar-cell drop-zone ${getWeekendClass(date)}`}>
                      {services.map(service => renderEventCard(service, 'service'))}
                      {absences.map(absence => renderEventCard(absence, 'absence'))}
                    </div>
                  );
                })}

                {/* New employee cell */}
                <div className={`calendar-cell ${getWeekendClass(date)}`}>
                  {/* Empty cell for new employee column */}
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Modals would go here */}
      {showServiceModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="text-lg font-bold mb-4">Rediger tjeneste</h2>
            <p>Service modal kommer i neste fase...</p>
            <button onClick={() => setShowServiceModal(false)} className="btn btn-secondary">
              Lukk
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;