# SMP Backend - Strategic Management Platform

## 📋 Overview

The SMP (Strategic Management Platform) backend is a comprehensive Node.js/Express.js REST API built for **NED University of Engineering & Technology** to manage academic strategic metrics, yearly ratings, and performance tracking across 12 strategic pillars. The system has been completely migrated from **.NET Core 8/MySQL** to **MERN Stack (MongoDB Atlas)** while maintaining full feature parity and API compatibility.

## 🚀 Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB Atlas (Cloud)
- **ODM**: Mongoose
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcrypt (10 salt rounds)
- **Environment Management**: dotenv
- **CORS**: cors middleware for cross-origin requests

## 🎯 Key Features

### 1. Year-Based Parameter Management System
- **Dynamic Cycle Management**: Create cycles with custom year ranges (e.g., 2041-2045, 2035-2038)
- **Progressive Year Activation**: Activate specific years within cycles for submissions
- **Dual Value System**:
  - **Actual Values**: For past/current years
  - **Projected Values**: For target/future years
- **Target Year Management**: Designate final year for strategic targets

### 2. 12 Strategic Pillars (Categories)
Each pillar represents a key strategic area:

1. **Strategic Pillar 1**: Academic Excellence
2. **Strategic Pillar 2**: Faculty Development
3. **Strategic Pillar 3**: Student Success
4. **Strategic Pillar 4**: Infrastructure and Facilities
5. **Strategic Pillar 5**: Professional Development
6. **Strategic Pillar 6**: Industry Collaboration
7. **Strategic Pillar 7**: Internationalisation
8. **Strategic Pillar 8**: Alumni Engagement
9. **Strategic Pillar 9**: Service to Community
10. **Strategic Pillar 10**: Research and Innovation
11. **Strategic Pillar 11**: Digitalisation
12. **Strategic Pillar 12**: Sustainability

### 3. Role-Based Access Control (RBAC)
- **Admin**: Full system access, user management, cycle management, reporting
- **Chairman**: Department-level parameter submissions and viewing
- **Dean**: Faculty-level oversight and reporting
- **VC (Vice Chancellor)**: University-wide visibility and strategic oversight
- **PVC (Pro-Vice Chancellor)**: University-wide access with administrative capabilities

### 4. University Structure
- **6 Faculties**: Engineering faculties with unique codes
- **43 Departments**: Academic departments linked to faculties
- **60+ Users**: Faculty, chairmen, deans, and administrators

### 5. Advanced Reporting System
- **Department-wise Reports**: Aggregated ratings by department
- **Faculty Comparison**: Cross-faculty performance analysis
- **Category Breakdown**: Performance by strategic pillar
- **Year-wise Tracking**: Historical data with yearly submissions
- **Excel Export**: Dynamic export with configurable columns

## 🗂️ Project Structure

```
SMP_Backend_New/
├── src/
│   ├── controllers/              # API endpoint handlers
│   │   ├── AuthController.js     # Authentication (login, register, JWT)
│   │   ├── CategoryController.js # 12 Strategic Pillars CRUD
│   │   ├── CycleController.js    # Cycle management & year activation
│   │   ├── DepartmentController.js # 43 Departments CRUD
│   │   ├── FacultyController.js  # 6 Faculties CRUD
│   │   ├── ParameterController.js # Parameters CRUD & management
│   │   ├── UserController.js     # User management
│   │   └── YearlyRatingController.js # Rating submissions & reports
│   │
│   ├── models/                   # Mongoose schemas
│   │   ├── User.js              # User model with roles
│   │   ├── Cycle.js             # Cycle with year activation
│   │   ├── Parameter.js         # Parameters linked to cycles
│   │   ├── Category.js          # 12 Strategic Pillars
│   │   ├── Faculty.js           # University faculties
│   │   ├── Department.js        # Academic departments
│   │   ├── YearlyRating.js      # Rating submissions
│   │   └── Counter.js           # Auto-increment integer IDs
│   │
│   ├── routes/                   # Express routes with middleware
│   │   ├── auth.js              # Authentication routes
│   │   ├── categories.js        # Category routes
│   │   ├── cycles.js            # Cycle routes
│   │   ├── departments.js       # Department routes
│   │   ├── faculties.js         # Faculty routes
│   │   ├── parameters.js        # Parameter routes
│   │   ├── users.js             # User routes
│   │   └── yearly-rating.js     # Rating routes
│   │
│   ├── middleware/               # Custom middleware
│   │   ├── auth.js              # JWT authentication
│   │   ├── errorHandler.js      # Global error handling
│   │   ├── roleAuth.js          # Role-based authorization
│   │   └── validate.js          # Request validation
│   │
│   ├── services/                 # Business logic layer
│   │   ├── RatingService.js     # Complex rating aggregations
│   │   ├── DashboardService.js  # Dashboard statistics
│   │   └── CounterService.js    # Auto-increment ID generation
│   │
│   ├── utils/                    # Utility functions
│   │   ├── jwt.js               # JWT token generation/validation
│   │   └── validators.js        # Input validation helpers
│   │
│   └── config/
│       └── db.js                 # MongoDB Atlas connection
│
├── migration-step-*.js           # Data migration scripts (6 files)
├── server.js                     # Application entry point
├── package.json                  # Dependencies & scripts
├── .env                          # Environment configuration
├── .env.example                  # Environment template
└── README.md                     # This file
```

## 📦 Installation & Setup

### Prerequisites
- **Node.js**: Version 18 or higher
- **MongoDB Atlas**: Cloud database account
- **npm**: Package manager (comes with Node.js)
- **Git**: Version control

### Step 1: Clone Repository
```bash
git clone <repository-url>
cd SMP_Backend_New
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Configure Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB Atlas Connection
# Replace <username>, <password>, and <cluster> with your MongoDB Atlas credentials
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/smp_database?retryWrites=true&w=majority

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
JWT_EXPIRE=12h

# CORS Configuration (React frontend URL)
CORS_ORIGIN=http://localhost:3000

# Application Settings
DEFAULT_ADMIN_EMAIL=admin@neduet.edu.pk
DEFAULT_ADMIN_PASSWORD=Admin@123
```

### Step 4: Start the Server

```bash
# Development mode with auto-reload (nodemon)
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:5000`

**Success Output:**
```
🚀 Server running on port 5000
✅ MongoDB Connected: cluster0.mongodb.net
```

## 🗄️ Database Schema

### Counter Model (Auto-Increment IDs)
```javascript
{
  _id: String,              // Collection name (e.g., "category", "parameter")
  sequence_value: Number    // Current counter value
}
```

**Usage**: Generates integer IDs for .NET compatibility
```javascript
const nextId = await Counter.getNextSequence('category');
// Returns: 1, 2, 3, 4... (auto-incrementing)
```

### User Model
```javascript
{
  _id: ObjectId,            // MongoDB ObjectId
  email: String,            // Unique, required
  userName: String,         // Unique username
  firstName: String,
  lastName: String,
  password: String,         // bcrypt hashed (salt rounds: 10)
  userRole: String,         // Admin, Chairman, Dean, VC, PVC
  deptId: Number,           // Reference to Department._id
  facultyId: Number,        // Reference to Faculty._id
  isActive: Boolean,        // Account status (default: true)
  status: String,           // active, inactive, suspended
  cycleAccess: [Number],    // Accessible cycle IDs

  // Activity tracking
  activityTracking: {
    lastLogin: Date,
    lastActivity: Date,
    loginCount: Number,
    failedLoginAttempts: Number
  },

  // User preferences
  userPreferences: {
    theme: String,          // light, dark
    language: String,       // en, ur
    notifications: Boolean,
    emailNotifications: Boolean
  },

  // Security
  securitySettings: {
    twoFactorEnabled: Boolean,
    passwordChangedAt: Date,
    accountLockedUntil: Date
  },

  createdAt: Date,          // Auto-generated
  updatedAt: Date,          // Auto-generated
  deletedAt: Date           // Soft delete timestamp (null = active)
}
```

### Cycle Model
```javascript
{
  _id: Number,              // Auto-increment integer ID
  name: String,             // Internal name
  cycleName: String,        // Display name (e.g., "2041-2045")
  description: String,      // Cycle description
  startYear: String,        // ISO date string "2041-01-01"
  endYear: String,          // ISO date string "2045-12-31"
  yearRange: String,        // Display format "2041-2045"
  cycleYears: [Number],     // [2041, 2042, 2043, 2044, 2045]
  activatedYears: [Number], // Subset of cycleYears enabled for submissions
  currentActiveYear: Number, // Current working year
  targetYear: Number,       // Final year for projected values (e.g., 2045)
  isActive: Boolean,        // Only one cycle can be active
  status: String,           // draft, active, completed, archived

  // Year activation details
  yearActivation: {
    "2041": {
      isActive: Boolean,
      actualSubmissionsEnabled: Boolean,
      projectedSubmissionsEnabled: Boolean,
      activatedAt: Date,
      activatedBy: String
    },
    // ... for each year
  },

  // Metadata
  totalParameters: Number,  // Count of parameters in this cycle
  activeParameters: Number, // Count of active parameters
  progressPercentage: Number, // Overall completion percentage

  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date
}
```

### Parameter Model
```javascript
{
  _id: Number,              // Auto-increment integer ID
  parameterName: String,    // Required, unique within category
  description: String,      // Parameter description
  category: String,         // Category name (e.g., "Strategic Pillar 1: Academic Excellence")
  cycle: Number,            // Reference to Cycle._id
  parameterType: String,    // Numeric, Text, Percentage, Boolean
  maxValue: Number,         // Maximum allowed value (for Numeric/Percentage)
  sortOrder: Number,        // Display order within category
  isActive: Boolean,        // Parameter enabled/disabled

  // Group access control
  accessibleToGroups: [String], // e.g., ["Academic Departments", "Administration"]
  restrictedAccess: Boolean,    // If true, only specific groups can access

  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date
}
```

### Category Model (12 Strategic Pillars)
```javascript
{
  _id: Number,              // Auto-increment integer ID (14-25 range)
  name: String,             // "Strategic Pillar 1: Academic Excellence"
  description: String,      // Detailed description
  sortOrder: Number,        // Display order (1-12)

  // Computed fields (not stored, calculated on query)
  parameterCount: Number,   // Total parameters in this category
  submittedCount: Number,   // User's submitted parameters count

  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date
}
```

### Faculty Model
```javascript
{
  _id: Number,              // Auto-increment integer ID
  name: String,             // Faculty name
  facultyCode: String,      // Unique code (e.g., "FoE", "FoCS")
  description: String,      // Faculty description

  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date
}
```

### Department Model
```javascript
{
  _id: Number,              // Auto-increment integer ID
  deptName: String,         // Department name
  deptCode: String,         // Unique code
  faculty: Number,          // Reference to Faculty._id
  description: String,      // Department description

  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date
}
```

### YearlyRating Model (Submissions)
```javascript
{
  _id: ObjectId,            // MongoDB ObjectId
  userId: Number,           // Reference to User._id (as integer for queries)
  parameterId: Number,      // Reference to Parameter._id
  categoryId: Number,       // Reference to Category._id
  departmentId: Number,     // Reference to Department._id
  facultyId: Number,        // Reference to Faculty._id
  cycle: Number,            // Year value (2041, 2042, etc.)

  // Value fields (one or both can be filled)
  actualValue: Number,      // Actual achieved value (for past/current years)
  projectedValue: Number,   // Projected target value (for future years)
  textValue: String,        // For text-type parameters
  justification: String,    // Explanation/reasoning for the value

  // Denormalized data for faster queries
  parameterName: String,    // Copied from Parameter
  categoryName: String,     // Copied from Category
  userName: String,         // Copied from User
  userEmail: String,        // Copied from User
  departmentName: String,   // Copied from Department

  // Metadata
  isReadOnly: Boolean,      // If true, cannot be edited
  submittedAt: Date,        // Submission timestamp

  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date
}
```

## 🔌 API Endpoints

### Base URL
```
http://localhost:5000/api
```

### Authentication Header (Required for protected routes)
```
Authorization: Bearer <jwt_token>
```

---

## 🔐 Authentication Endpoints

### 1. User Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "Username": "admin@neduet.edu.pk",
  "Password": "Admin@123",
  "RememberMe": false
}
```

**Response:**
```json
{
  "Status": true,
  "Message": "Login successful!",
  "Data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "role": ["Admin"],
    "expiration": "2025-01-06T12:00:00.000Z"
  }
}
```

### 2. User Registration
```http
POST /api/auth/register
Content-Type: application/json

{
  "Username": "chairman@neduet.edu.pk",
  "Email": "chairman@neduet.edu.pk",
  "Password": "Chairman@123",
  "FirstName": "John",
  "LastName": "Doe",
  "UserRole": "Chairman",
  "DeptId": 1,
  "FacultyId": 1
}
```

### 3. Refresh Token
```http
POST /api/auth/refresh-token
Authorization: Bearer <old_token>
```

### 4. Change Password
```http
POST /api/auth/change-password
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "Username": "user@neduet.edu.pk",
  "OldPassword": "OldPass@123",
  "NewPassword": "NewPass@123"
}
```

### 5. Get Current User Profile
```http
GET /api/auth/profile
Authorization: Bearer <jwt_token>
```

---

## 📊 Category Endpoints (12 Strategic Pillars)

### 1. Get All Categories
```http
GET /api/categories?page=1&pageSize=20&search=Academic
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `pageSize` (optional): Items per page (default: 20)
- `search` (optional): Search by name

**Response:**
```json
{
  "Status": true,
  "Message": "Categories retrieved successfully",
  "Data": [
    {
      "_id": 14,
      "id": 14,
      "name": "Strategic Pillar 1: Academic Excellence",
      "description": "Focus on academic quality and excellence",
      "sortOrder": 1,
      "parameterCount": 36,
      "submittedCount": 5,
      "createdAt": "2025-01-05T10:00:00.000Z",
      "updatedAt": "2025-01-05T10:00:00.000Z",
      "deletedAt": null
    }
  ],
  "TotalCount": 12,
  "Page": 1,
  "PageSize": 20
}
```

### 2. Get Category by ID
```http
GET /api/categories/:id
Authorization: Bearer <jwt_token>
```

### 3. Create Category
```http
POST /api/categories
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "Strategic Pillar 13: New Pillar",
  "description": "New strategic focus area",
  "sortOrder": 13
}
```

### 4. Update Category
```http
PUT /api/categories/:id
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "Updated Pillar Name",
  "description": "Updated description",
  "sortOrder": 1
}
```

### 5. Delete Category (Soft Delete)
```http
DELETE /api/categories/:id
Authorization: Bearer <jwt_token>
```

---

## 🔄 Cycle Endpoints

### 1. Get All Cycles
```http
GET /api/cycles?page=1&limit=10&status=active&sortBy=createdAt&sortOrder=desc
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page
- `status` (optional): draft, active, completed, archived
- `sortBy` (optional): Field to sort by
- `sortOrder` (optional): asc, desc

**Response:**
```json
{
  "Status": true,
  "Message": "Cycles retrieved successfully",
  "Data": {
    "cycles": [
      {
        "_id": 2,
        "id": 2,
        "name": "2041-2045",
        "cycleName": "2041-2045",
        "yearRange": "2041-2045",
        "cycleYears": [2041, 2042, 2043, 2044, 2045],
        "activatedYears": [2041, 2042],
        "currentActiveYear": 2042,
        "targetYear": 2045,
        "isActive": true,
        "status": "active",
        "totalParameters": 88,
        "activeParameters": 88,
        "progressPercentage": 15
      }
    ],
    "pagination": {
      "totalItems": 4,
      "totalPages": 1,
      "currentPage": 1,
      "pageSize": 10
    }
  }
}
```

### 2. Get Active Cycle
```http
GET /api/cycles/active
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "Status": true,
  "Message": "Active cycle retrieved successfully",
  "Data": {
    "_id": 2,
    "cycleName": "2041-2045",
    "activatedYears": [2041, 2042],
    "targetYear": 2045,
    "isActive": true
  }
}
```

### 3. Get Cycle by ID
```http
GET /api/cycles/:id?includeParameters=true
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `includeParameters` (optional): Include related parameters (default: false)

### 4. Create Cycle
```http
POST /api/cycles
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "2046-2050",
  "cycleName": "2046-2050",
  "description": "Strategic Plan 2046-2050",
  "startYear": "2046-01-01",
  "endYear": "2050-12-31"
}
```

### 5. Update Cycle
```http
PUT /api/cycles/:id
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "2041-2045 Updated",
  "description": "Updated description",
  "isActive": true
}
```

### 6. Batch Activate/Deactivate Years
```http
POST /api/cycles/:id/batch-activate-years
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "years": [2041, 2042, 2043],
  "action": "activate",
  "reason": "Enabling years for Q1 2025 submissions"
}
```

**Actions:**
- `activate`: Enable years for submissions
- `deactivate`: Disable years for submissions

### 7. Delete Cycle (Soft Delete)
```http
DELETE /api/cycles/:id
Authorization: Bearer <jwt_token>
```

---

## 📝 Parameter Endpoints

### 1. Get All Parameters
```http
GET /api/parameters?page=1&pageSize=20&category=Strategic%20Pillar%201&cycle=2&isActive=true
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `page` (optional): Page number
- `pageSize` (optional): Items per page
- `category` (optional): Filter by category name
- `cycle` (optional): Filter by cycle ID
- `isActive` (optional): Filter by active status
- `search` (optional): Search by parameter name

**Response:**
```json
{
  "Status": true,
  "Message": "Parameters retrieved successfully",
  "Data": [
    {
      "_id": 123,
      "id": 123,
      "parameterName": "Student Enrollment Rate",
      "description": "Percentage of students enrolled",
      "category": "Strategic Pillar 1: Academic Excellence",
      "cycle": 2,
      "parameterType": "Percentage",
      "maxValue": 100,
      "sortOrder": 1,
      "isActive": true,
      "accessibleToGroups": ["Academic Departments"],
      "restrictedAccess": true
    }
  ],
  "TotalCount": 88,
  "Page": 1,
  "PageSize": 20
}
```

### 2. Get Parameter by ID
```http
GET /api/parameters/:id
Authorization: Bearer <jwt_token>
```

### 3. Get Parameter Details (with Cycles)
```http
GET /api/parameters/details/:id
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "Status": true,
  "Data": {
    "parameter": {
      "_id": 123,
      "parameterName": "Student Enrollment Rate",
      "category": "Strategic Pillar 1: Academic Excellence",
      "parameterType": "Percentage",
      "maxValue": 100
    },
    "cycles": [
      {
        "year": 2041,
        "isTarget": false,
        "isActive": true,
        "actualSubmissionsEnabled": true,
        "projectedSubmissionsEnabled": false
      },
      {
        "year": 2045,
        "isTarget": true,
        "isActive": true,
        "actualSubmissionsEnabled": false,
        "projectedSubmissionsEnabled": true
      }
    ],
    "submissions": [
      {
        "cycle": 2041,
        "actualValue": 85,
        "projectedValue": null,
        "submittedAt": "2025-01-05T10:00:00.000Z"
      }
    ]
  }
}
```

### 4. Get Parameters by Category
```http
GET /api/parameters/list/:categoryName
Authorization: Bearer <jwt_token>
```

### 5. Create Parameter
```http
POST /api/parameters
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "parameterName": "Faculty Retention Rate",
  "description": "Percentage of faculty retained year-over-year",
  "category": "Strategic Pillar 2: Faculty Development",
  "cycle": 2,
  "parameterType": "Percentage",
  "maxValue": 100,
  "sortOrder": 5,
  "isActive": true,
  "accessibleToGroups": ["Academic Departments", "Administration"],
  "restrictedAccess": true
}
```

### 6. Update Parameter
```http
PUT /api/parameters/:id
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "parameterName": "Updated Parameter Name",
  "description": "Updated description",
  "maxValue": 150,
  "isActive": true
}
```

### 7. Delete Parameter (Soft Delete)
```http
DELETE /api/parameters/:id
Authorization: Bearer <jwt_token>
```

---

## 📈 Yearly Rating Endpoints (Submissions)

### 1. Submit Individual Parameter
```http
POST /api/yearly-rating/submit-parameter
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "parameterId": 123,
  "cycle": 2041,
  "values": {
    "actualValue": 85,
    "projectedValue": null,
    "textValue": "Achieved 85% enrollment"
  }
}
```

**Response:**
```json
{
  "Status": true,
  "Message": "Parameter submitted successfully",
  "Data": {
    "_id": "507f1f77bcf86cd799439011",
    "userId": 1,
    "parameterId": 123,
    "cycle": 2041,
    "actualValue": 85,
    "submittedAt": "2025-01-05T10:00:00.000Z"
  }
}
```

### 2. Get Ratings by Department
```http
GET /api/yearly-rating/by-department/:deptId?cycleId=2&categoryId=14
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `cycleId` (optional): Filter by cycle ID
- `categoryId` (optional): Filter by category ID

**Response:**
```json
{
  "Status": true,
  "Message": "Ratings retrieved successfully",
  "Data": [
    {
      "parameterName": "Student Enrollment Rate",
      "categoryId": 14,
      "categoryName": "Strategic Pillar 1: Academic Excellence",
      "userName": "John Doe",
      "userEmail": "john.doe@neduet.edu.pk",
      "departmentId": 1,
      "departmentName": "Computer Science",
      "yearlyValues": [
        {
          "year": 2041,
          "actualValue": 85,
          "projectedValue": null,
          "textValue": null
        },
        {
          "year": 2045,
          "actualValue": null,
          "projectedValue": 95,
          "textValue": null
        }
      ],
      "createdAt": "2025-01-05T10:00:00.000Z",
      "updatedAt": "2025-01-05T12:00:00.000Z"
    }
  ]
}
```

### 3. Get All Ratings
```http
GET /api/yearly-rating/all?page=1&pageSize=10&cycle=2041&category=14&department=1
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `page` (optional): Page number
- `pageSize` (optional): Items per page
- `cycle` (optional): Filter by cycle year
- `category` (optional): Filter by category ID
- `department` (optional): Filter by department ID

### 4. Get Rating by ID
```http
GET /api/yearly-rating/:id
Authorization: Bearer <jwt_token>
```

### 5. Update Rating
```http
PUT /api/yearly-rating/:id
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "actualValue": 90,
  "justification": "Updated based on new data"
}
```

### 6. Delete Rating
```http
DELETE /api/yearly-rating/:id
Authorization: Bearer <jwt_token>
```

### 7. Get Rating Statistics
```http
GET /api/yearly-rating/statistics?cycle=2&category=14
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "Status": true,
  "Data": {
    "totalRatings": 250,
    "averageScore": 82.5,
    "maxScore": 100,
    "minScore": 45,
    "totalParameters": 88,
    "departmentCount": 43,
    "facultyCount": 6,
    "categoryCount": 12,
    "submissionRate": 75.5
  }
}
```

---

## 🏢 Faculty Endpoints

### 1. Get All Faculties
```http
GET /api/faculties?page=1&pageSize=20&search=Engineering
Authorization: Bearer <jwt_token>
```

### 2. Get Faculty by ID
```http
GET /api/faculties/:id
Authorization: Bearer <jwt_token>
```

### 3. Create Faculty
```http
POST /api/faculties
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "Faculty of Engineering",
  "facultyCode": "FoE",
  "description": "Main engineering faculty"
}
```

### 4. Update Faculty
```http
PUT /api/faculties/:id
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "Updated Faculty Name",
  "description": "Updated description"
}
```

### 5. Delete Faculty
```http
DELETE /api/faculties/:id
Authorization: Bearer <jwt_token>
```

---

## 🏛️ Department Endpoints

### 1. Get All Departments
```http
GET /api/departments?page=1&pageSize=50&facultyId=1&search=Computer
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `page` (optional): Page number
- `pageSize` (optional): Items per page
- `facultyId` (optional): Filter by faculty ID
- `search` (optional): Search by department name

**Response:**
```json
{
  "Status": true,
  "Message": "Departments retrieved successfully",
  "Data": [
    {
      "_id": 1,
      "id": 1,
      "deptName": "Computer Science & Engineering",
      "deptCode": "CSE",
      "faculty": {
        "_id": 1,
        "name": "Faculty of Engineering",
        "facultyCode": "FoE"
      },
      "description": "Computer Science Department"
    }
  ],
  "TotalCount": 43,
  "Page": 1,
  "PageSize": 50
}
```

### 2. Get Department by ID
```http
GET /api/departments/:id
Authorization: Bearer <jwt_token>
```

### 3. Create Department
```http
POST /api/departments
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "deptName": "Artificial Intelligence",
  "deptCode": "AI",
  "faculty": 1,
  "description": "AI and Machine Learning Department"
}
```

### 4. Update Department
```http
PUT /api/departments/:id
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "deptName": "Updated Department Name",
  "faculty": 2,
  "description": "Updated description"
}
```

### 5. Delete Department
```http
DELETE /api/departments/:id
Authorization: Bearer <jwt_token>
```

---

## 👥 User Endpoints

### 1. Get All Users
```http
GET /api/users?page=1&pageSize=20&role=Chairman&departmentId=1
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `page` (optional): Page number
- `pageSize` (optional): Items per page
- `role` (optional): Filter by user role
- `departmentId` (optional): Filter by department
- `facultyId` (optional): Filter by faculty
- `isActive` (optional): Filter by active status

### 2. Get User by ID
```http
GET /api/users/:id
Authorization: Bearer <jwt_token>
```

### 3. Create User
```http
POST /api/users
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "email": "newuser@neduet.edu.pk",
  "userName": "newuser",
  "firstName": "Jane",
  "lastName": "Smith",
  "password": "SecurePass@123",
  "userRole": "Chairman",
  "deptId": 1,
  "facultyId": 1,
  "phoneNumber": "+92-300-1234567"
}
```

### 4. Update User
```http
PUT /api/users/:id
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "firstName": "Updated First Name",
  "userRole": "Dean",
  "isActive": true
}
```

### 5. Delete User
```http
DELETE /api/users/:id
Authorization: Bearer <jwt_token>
```

---

## 📊 Dashboard Endpoints

### 1. Get Dashboard Statistics
```http
GET /api/dashboard/statistics
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "Status": true,
  "Message": "Dashboard statistics retrieved successfully",
  "Data": {
    "categories": [
      {
        "_id": 14,
        "id": 14,
        "name": "Strategic Pillar 1: Academic Excellence",
        "description": "Focus on academic quality",
        "sortOrder": 1,
        "parameterCount": 36,
        "submittedCount": 12
      }
    ],
    "totalParameters": 88,
    "totalSubmissions": 156,
    "completionRate": 45.5
  }
}
```

---

## 🔒 Authentication & Authorization

### JWT Token Structure
```json
{
  "userId": 1,
  "email": "admin@neduet.edu.pk",
  "role": "Admin",
  "iat": 1704441600,
  "exp": 1704484800
}
```

### Token Expiration
- **Default**: 12 hours
- **Configurable**: Via `JWT_EXPIRE` in `.env`

### Protected Routes
All endpoints except the following require JWT authentication:
- `POST /api/auth/login`
- `POST /api/auth/register`

### Role-Based Access
Different endpoints require different roles:

| Role | Access Level |
|------|-------------|
| **Admin** | Full access to all endpoints |
| **Chairman** | Department-specific submissions and reports |
| **Dean** | Faculty-level reports and oversight |
| **VC** | University-wide visibility |
| **PVC** | University-wide administrative access |

---

## 🚀 Business Logic

### Year-Based Submission Workflow

1. **Admin Creates Cycle**: 2041-2045 with years [2041, 2042, 2043, 2044, 2045]
2. **Admin Activates Years**: Enable 2041 and 2042 for submissions
3. **Parameters Created**: Linked to the active cycle
4. **Users Submit Values**:
   - **2041 (Current Year)**: Submit actual values
   - **2045 (Target Year)**: Submit projected values
5. **Progressive Activation**: Admin can activate more years as time progresses

### Example Submission Flow

**Year 2041 Submission (Actual):**
```json
{
  "parameterId": 123,
  "cycle": 2041,
  "values": {
    "actualValue": 85,
    "projectedValue": null
  }
}
```

**Year 2045 Submission (Projected):**
```json
{
  "parameterId": 123,
  "cycle": 2045,
  "values": {
    "actualValue": null,
    "projectedValue": 95
  }
}
```

### Rating Aggregation Logic

The `RatingService.getRatingsByDepartment()` performs complex MongoDB aggregation:

1. **Fetch Submissions**: Get all ratings for department/cycle/category
2. **Lookup Users**: Join with Users collection
3. **Lookup Categories**: Join with Categories collection
4. **Lookup Departments**: Join with Departments collection
5. **Group by User+Parameter**: Consolidate multiple year submissions
6. **Sort**: Order by category, parameter name
7. **Return**: Aggregated data with yearly values array

**Example Aggregated Output:**
```json
{
  "parameterName": "Student Enrollment Rate",
  "userName": "John Doe",
  "departmentName": "Computer Science",
  "yearlyValues": [
    {"year": 2041, "actualValue": 85, "projectedValue": null},
    {"year": 2042, "actualValue": 87, "projectedValue": null},
    {"year": 2045, "actualValue": null, "projectedValue": 95}
  ]
}
```

---

## 📦 Data Migration

The system includes 6 migration scripts to import data from legacy .NET/MySQL system:

### Migration Sequence

```bash
# Run migrations in order:

# Step 1: Import 12 Strategic Pillars
node migration-step-1-categories.js
# ✅ Creates categories with IDs 14-25

# Step 2: Import 6 Faculties
node migration-step-2-faculties.js
# ✅ Creates faculties with auto-increment IDs

# Step 3: Import Cycles
node migration-step-3-cycles.js
# ✅ Creates cycles with year activation structure

# Step 4: Import 43 Departments
node migration-step-4-departments.js
# ✅ Creates departments with faculty links

# Step 5: Import Parameters
node migration-step-5-parameters.js
# ✅ Creates parameters linked to cycles

# Step 6: Import 60+ Users
node migration-step-6-users.js
# ✅ Creates users with roles and department assignments
```

### Migration Features
- ✅ Auto-increment integer IDs for compatibility
- ✅ Soft delete pattern (deletedAt field)
- ✅ Data validation and error handling
- ✅ Relationship integrity maintenance
- ✅ Progress logging and error reporting

---

## 🛡️ Security Features

### 1. Password Security
- **Hashing**: bcrypt with 10 salt rounds
- **Minimum Requirements**: 8 characters, uppercase, lowercase, number, special char
- **Storage**: Only hashed passwords stored in database

### 2. JWT Security
- **Secret Key**: 256-bit secret from environment
- **Expiration**: 12-hour token validity
- **Claims**: userId, email, role
- **Refresh**: Token refresh endpoint available

### 3. Input Validation
- **Request Validation**: All inputs validated before processing
- **SQL Injection Prevention**: Mongoose parameterized queries
- **XSS Protection**: Input sanitization
- **CORS**: Restricted to configured origins

### 4. Rate Limiting
- **Login Attempts**: Max 5 failed attempts before lockout
- **API Throttling**: Configurable rate limits per endpoint

### 5. Audit Trail
- **Activity Tracking**: User login/logout logged
- **Change History**: Parameter/cycle modifications tracked
- **Soft Deletes**: Deletion history maintained

---

## 🎯 Performance Optimizations

### 1. Database Indexing
```javascript
// Indexed fields for faster queries
User: ['email', 'userName', 'userRole', 'deletedAt']
Parameter: ['_id', 'category', 'cycle', 'deletedAt']
YearlyRating: ['userId', 'parameterId', 'cycle', 'deletedAt']
Category: ['_id', 'name', 'sortOrder', 'deletedAt']
Cycle: ['_id', 'isActive', 'status', 'deletedAt']
```

### 2. MongoDB Aggregation
- Complex joins performed in database
- Reduced network overhead
- Faster query execution

### 3. Connection Pooling
- Mongoose connection pooling enabled
- Automatic connection retry logic
- Connection timeout: 30 seconds

### 4. Pagination
- Default page size: 20 items
- Maximum page size: 100 items
- Efficient skip/limit queries

### 5. Lean Queries
- `.lean()` used for read-only operations
- Reduces memory overhead
- Faster document retrieval

---

## 🐛 Error Handling

### Standard Error Response Format
```json
{
  "Status": false,
  "Message": "Descriptive error message",
  "status": 400
}
```

### Error Types

| Status Code | Type | Example |
|------------|------|---------|
| 400 | Bad Request | Invalid input data |
| 401 | Unauthorized | Missing/invalid JWT token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate record |
| 500 | Internal Server Error | Database connection failed |

### Error Logging
- All errors logged with stack traces
- Request details captured for debugging
- User-friendly error messages returned

---

## 🧪 Testing

### Manual Testing with Postman

1. **Create Admin User**
```bash
POST http://localhost:5000/api/auth/register
{
  "Username": "admin@neduet.edu.pk",
  "Email": "admin@neduet.edu.pk",
  "Password": "Admin@123",
  "FirstName": "Admin",
  "LastName": "User",
  "UserRole": "Admin"
}
```

2. **Login and Get JWT Token**
```bash
POST http://localhost:5000/api/auth/login
{
  "Username": "admin@neduet.edu.pk",
  "Password": "Admin@123"
}
# Save the token from response
```

3. **Create Faculty (ID: 1)**
```bash
POST http://localhost:5000/api/faculties
Headers: Authorization: Bearer <token>
{
  "name": "Faculty of Engineering",
  "facultyCode": "FoE"
}
```

4. **Create Department (ID: 1)**
```bash
POST http://localhost:5000/api/departments
Headers: Authorization: Bearer <token>
{
  "deptName": "Computer Science",
  "deptCode": "CS",
  "faculty": 1
}
```

5. **Create Cycle (ID: 1)**
```bash
POST http://localhost:5000/api/cycles
Headers: Authorization: Bearer <token>
{
  "name": "2041-2045",
  "cycleName": "2041-2045",
  "startYear": "2041-01-01",
  "endYear": "2045-12-31"
}
```

6. **Activate Years**
```bash
POST http://localhost:5000/api/cycles/1/batch-activate-years
Headers: Authorization: Bearer <token>
{
  "years": [2041, 2045],
  "action": "activate"
}
```

7. **Create Parameter (ID: 1)**
```bash
POST http://localhost:5000/api/parameters
Headers: Authorization: Bearer <token>
{
  "parameterName": "Test Parameter",
  "category": "Strategic Pillar 1: Academic Excellence",
  "cycle": 1,
  "parameterType": "Numeric",
  "maxValue": 100
}
```

8. **Submit Rating**
```bash
POST http://localhost:5000/api/yearly-rating/submit-parameter
Headers: Authorization: Bearer <token>
{
  "parameterId": 1,
  "cycle": 2041,
  "values": {
    "actualValue": 85
  }
}
```

---

