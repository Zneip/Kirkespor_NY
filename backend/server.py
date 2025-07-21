from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, date, time
from pymongo import MongoClient
import os
from dotenv import load_dotenv
import uuid
import json

load_dotenv()

# MongoDB setup
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017/kirkespor_db")
client = MongoClient(MONGO_URL)
db = client.kirkespor_db

app = FastAPI(title="Kirkespor API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class Employee(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    active: bool = True
    position: int = 0  # Column position
    created_at: datetime = Field(default_factory=datetime.now)

class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    active: Optional[bool] = None
    position: Optional[int] = None

class Church(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    active: bool = True
    created_at: datetime = Field(default_factory=datetime.now)

class ChurchUpdate(BaseModel):
    name: Optional[str] = None
    active: Optional[bool] = None

class Service(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str  # Gudstjeneste, Vielse, Konsert, Annet, Vikartjeneste
    date: str  # YYYY-MM-DD format
    time: str  # HH:MM format
    employee_id: Optional[str] = None  # None means in inbox
    church_id: str
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)

class ServiceUpdate(BaseModel):
    type: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    employee_id: Optional[str] = None
    church_id: Optional[str] = None
    notes: Optional[str] = None

class Absence(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str  # Frihelg, Avspasering, Sykemelding, Ferie
    start_date: str  # YYYY-MM-DD format
    end_date: str  # YYYY-MM-DD format
    employee_id: str
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)

class AbsenceUpdate(BaseModel):
    type: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    employee_id: Optional[str] = None
    notes: Optional[str] = None

class Settings(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    inbox_width: int = 170
    updated_at: datetime = Field(default_factory=datetime.now)

class CalendarFilter(BaseModel):
    start_date: str
    end_date: str
    compact_mode: bool = False

class CalendarResponse(BaseModel):
    services: List[Dict[str, Any]]
    absences: List[Dict[str, Any]]
    employees: List[Dict[str, Any]]
    churches: List[Dict[str, Any]]
    date_range: List[str]

# Helper functions
def serialize_doc(doc):
    """Convert MongoDB document to JSON serializable format"""
    if doc is None:
        return None
    if '_id' in doc:
        del doc['_id']
    if 'created_at' in doc and isinstance(doc['created_at'], datetime):
        doc['created_at'] = doc['created_at'].isoformat()
    if 'updated_at' in doc and isinstance(doc['updated_at'], datetime):
        doc['updated_at'] = doc['updated_at'].isoformat()
    return doc

def generate_date_range(start_date: str, end_date: str) -> List[str]:
    """Generate list of dates between start and end date"""
    from datetime import datetime, timedelta
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")
    
    dates = []
    current = start
    while current <= end:
        dates.append(current.strftime("%Y-%m-%d"))
        current += timedelta(days=1)
    
    return dates

# Employee endpoints
@app.get("/api/employees", response_model=List[Employee])
async def get_employees():
    """Get all active employees"""
    employees = list(db.employees.find({"active": True}).sort("position", 1))
    return [serialize_doc(emp) for emp in employees]

@app.post("/api/employees", response_model=Employee)
async def create_employee(employee: Employee):
    """Create new employee"""
    employee_dict = employee.dict()
    db.employees.insert_one(employee_dict)
    return serialize_doc(employee_dict)

@app.put("/api/employees/{employee_id}", response_model=Employee)
async def update_employee(employee_id: str, employee: EmployeeUpdate):
    """Update employee"""
    update_data = {k: v for k, v in employee.dict().items() if v is not None}
    result = db.employees.find_one_and_update(
        {"id": employee_id},
        {"$set": update_data},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Employee not found")
    return serialize_doc(result)

@app.delete("/api/employees/{employee_id}")
async def delete_employee(employee_id: str):
    """Soft delete employee"""
    result = db.employees.find_one_and_update(
        {"id": employee_id},
        {"$set": {"active": False}},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Employee not found")
    return {"message": "Employee deleted successfully"}

# Church endpoints
@app.get("/api/churches", response_model=List[Church])
async def get_churches():
    """Get all active churches"""
    churches = list(db.churches.find({"active": True}))
    return [serialize_doc(church) for church in churches]

@app.post("/api/churches", response_model=Church)
async def create_church(church: Church):
    """Create new church"""
    church_dict = church.dict()
    db.churches.insert_one(church_dict)
    return serialize_doc(church_dict)

@app.put("/api/churches/{church_id}", response_model=Church)
async def update_church(church_id: str, church: ChurchUpdate):
    """Update church"""
    update_data = {k: v for k, v in church.dict().items() if v is not None}
    result = db.churches.find_one_and_update(
        {"id": church_id},
        {"$set": update_data},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Church not found")
    return serialize_doc(result)

@app.delete("/api/churches/{church_id}")
async def delete_church(church_id: str):
    """Soft delete church"""
    result = db.churches.find_one_and_update(
        {"id": church_id},
        {"$set": {"active": False}},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Church not found")
    return {"message": "Church deleted successfully"}

# Service endpoints
@app.get("/api/services")
async def get_services(start_date: Optional[str] = None, end_date: Optional[str] = None):
    """Get services with optional date filtering"""
    query = {}
    if start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
    
    services = list(db.services.find(query))
    return [serialize_doc(service) for service in services]

@app.post("/api/services", response_model=Service)
async def create_service(service: Service):
    """Create new service"""
    service_dict = service.dict()
    db.services.insert_one(service_dict)
    return serialize_doc(service_dict)

@app.put("/api/services/{service_id}", response_model=Service)
async def update_service(service_id: str, service: ServiceUpdate):
    """Update service"""
    update_data = {k: v for k, v in service.dict().items() if v is not None}
    result = db.services.find_one_and_update(
        {"id": service_id},
        {"$set": update_data},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Service not found")
    return serialize_doc(result)

@app.delete("/api/services/{service_id}")
async def delete_service(service_id: str):
    """Delete service"""
    result = db.services.delete_one({"id": service_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    return {"message": "Service deleted successfully"}

# Absence endpoints
@app.get("/api/absences")
async def get_absences(start_date: Optional[str] = None, end_date: Optional[str] = None):
    """Get absences with optional date filtering"""
    query = {}
    if start_date and end_date:
        query["$or"] = [
            {"start_date": {"$lte": end_date}, "end_date": {"$gte": start_date}}
        ]
    
    absences = list(db.absences.find(query))
    return [serialize_doc(absence) for absence in absences]

@app.post("/api/absences", response_model=Absence)
async def create_absence(absence: Absence):
    """Create new absence"""
    absence_dict = absence.dict()
    db.absences.insert_one(absence_dict)
    return serialize_doc(absence_dict)

@app.put("/api/absences/{absence_id}", response_model=Absence)
async def update_absence(absence_id: str, absence: AbsenceUpdate):
    """Update absence"""
    update_data = {k: v for k, v in absence.dict().items() if v is not None}
    result = db.absences.find_one_and_update(
        {"id": absence_id},
        {"$set": update_data},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Absence not found")
    return serialize_doc(result)

@app.delete("/api/absences/{absence_id}")
async def delete_absence(absence_id: str):
    """Delete absence"""
    result = db.absences.delete_one({"id": absence_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Absence not found")
    return {"message": "Absence deleted successfully"}

# Calendar endpoint
@app.post("/api/calendar", response_model=CalendarResponse)
async def get_calendar_data(filter: CalendarFilter):
    """Get complete calendar data for date range"""
    # Get services in date range
    services = list(db.services.find({
        "date": {"$gte": filter.start_date, "$lte": filter.end_date}
    }))
    
    # Get absences that overlap with date range
    absences = list(db.absences.find({
        "$or": [
            {"start_date": {"$lte": filter.end_date}, "end_date": {"$gte": filter.start_date}}
        ]
    }))
    
    # Get active employees and churches
    employees = list(db.employees.find({"active": True}).sort("position", 1))
    churches = list(db.churches.find({"active": True}))
    
    # Generate date range
    date_range = generate_date_range(filter.start_date, filter.end_date)
    
    # If compact mode, filter to only dates with events
    if filter.compact_mode:
        event_dates = set()
        for service in services:
            event_dates.add(service["date"])
        for absence in absences:
            # Add all dates in absence range
            absence_dates = generate_date_range(absence["start_date"], absence["end_date"])
            event_dates.update(absence_dates)
        
        date_range = [d for d in date_range if d in event_dates]
    
    return {
        "services": [serialize_doc(s) for s in services],
        "absences": [serialize_doc(a) for a in absences],
        "employees": [serialize_doc(e) for e in employees],
        "churches": [serialize_doc(c) for c in churches],
        "date_range": date_range
    }

# Settings endpoints
@app.get("/api/settings")
async def get_settings():
    """Get settings"""
    settings = db.settings.find_one() or {"inbox_width": 170}
    return serialize_doc(settings)

@app.post("/api/settings")
async def update_settings(settings: Settings):
    """Update settings"""
    settings_dict = settings.dict()
    db.settings.replace_one({}, settings_dict, upsert=True)
    return serialize_doc(settings_dict)

# Backup endpoints
@app.get("/api/backup")
async def export_backup():
    """Export all data as JSON"""
    data = {
        "employees": [serialize_doc(e) for e in db.employees.find({})],
        "churches": [serialize_doc(c) for c in db.churches.find({})],
        "services": [serialize_doc(s) for s in db.services.find({})],
        "absences": [serialize_doc(a) for a in db.absences.find({})],
        "settings": serialize_doc(db.settings.find_one()) or {"inbox_width": 170}
    }
    return data

@app.post("/api/backup/import")
async def import_backup(data: Dict[str, Any]):
    """Import data from JSON backup"""
    try:
        # Clear existing data
        db.employees.delete_many({})
        db.churches.delete_many({})
        db.services.delete_many({})
        db.absences.delete_many({})
        db.settings.delete_many({})
        
        # Import new data
        if "employees" in data and data["employees"]:
            db.employees.insert_many(data["employees"])
        if "churches" in data and data["churches"]:
            db.churches.insert_many(data["churches"])
        if "services" in data and data["services"]:
            db.services.insert_many(data["services"])
        if "absences" in data and data["absences"]:
            db.absences.insert_many(data["absences"])
        if "settings" in data and data["settings"]:
            db.settings.insert_one(data["settings"])
        
        return {"message": "Backup imported successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Import failed: {str(e)}")

# Health check
@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Test database connection
        db.command("ismaster")
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database connection failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)