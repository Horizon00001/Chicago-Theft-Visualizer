-- Database Schema for Chicago Theft Visualizer

-- Drop table if exists
DROP TABLE IF EXISTS crimes;

-- Create crimes table
CREATE TABLE crimes (
    id SERIAL PRIMARY KEY,
    case_number VARCHAR(20),
    date TIMESTAMP NOT NULL,
    block VARCHAR(100),
    iucr VARCHAR(10),
    primary_type VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    location_description VARCHAR(255),
    arrest BOOLEAN DEFAULT FALSE,
    domestic BOOLEAN DEFAULT FALSE,
    beat VARCHAR(10),
    district VARCHAR(10),
    ward VARCHAR(10),
    community_area VARCHAR(10),
    fbi_code VARCHAR(10),
    x_coordinate DOUBLE PRECISION,
    y_coordinate DOUBLE PRECISION,
    year INTEGER,
    updated_on TIMESTAMP,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    location VARCHAR(100)
);

-- Create indexes for performance
CREATE INDEX idx_crimes_date ON crimes(date);
CREATE INDEX idx_crimes_primary_type ON crimes(primary_type);
CREATE INDEX idx_crimes_district ON crimes(district);
CREATE INDEX idx_crimes_arrest ON crimes(arrest);
CREATE INDEX idx_crimes_domestic ON crimes(domestic);
