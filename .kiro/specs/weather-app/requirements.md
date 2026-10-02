# Requirements Document

## Introduction

The Weather App is a simple web application that displays current weather conditions and a 5-day forecast for a United States city entered by the user. The user types a city name into a text field, and the application retrieves and displays the current weather conditions and the upcoming forecast for that location, including weather icons representing conditions such as sunny, rainy, and cloudy.

Because the National Weather Service (weather.gov) API requires geographic coordinates rather than city names, the application first converts the user-entered city name into latitude and longitude using the Nominatim geocoding service (which supports cross-origin browser requests, avoiding CORS errors). The application then queries the National Weather Service API with those coordinates to obtain current weather conditions.

The application is built with HTML and JavaScript and is served locally on `localhost:8080` using a PowerShell script that starts a local HTTP server. The design is intentionally minimal, with no caching, classes, or interfaces, and no hardcoded or stored city data.

## Glossary

- **Weather_App**: The web application built with HTML and JavaScript that accepts a city name and displays current weather conditions.
- **User**: A person who enters a United States city name into the Weather_App UI.
- **City_Name**: A free-text value entered by the User identifying a United States city.
- **Geocoding_Service**: The Nominatim service that converts a City_Name into geographic coordinates (latitude and longitude).
- **Coordinates**: The latitude and longitude pair returned by the Geocoding_Service for a City_Name.
- **Weather_Service**: The National Weather Service (weather.gov) API that returns current weather conditions for a given set of Coordinates.
- **Weather_Conditions**: The current weather data (such as temperature, textual forecast, and wind) returned by the Weather_Service.
- **Forecast**: The multi-day weather outlook returned by the Weather_Service, consisting of a sequence of daily periods each with a date, temperature, and short textual condition.
- **Weather_Icon**: A visual symbol displayed by the Weather_App representing a weather condition category (such as sunny, rainy, or cloudy) derived from a textual condition.
- **HTTP_Server**: The local HTTP server, started by a PowerShell script, that serves the Weather_App on `localhost:8080`.
- **Startup_Script**: The PowerShell script that starts the HTTP_Server, with an optional batch script fallback for path-related startup issues.

## Requirements

### Requirement 1: Enter a City Name

**User Story:** As a user, I want to enter a United States city name, so that I can request its current weather conditions.

#### Acceptance Criteria

1. THE Weather_App SHALL display a text input field that accepts a City_Name of 1 to 100 characters.
2. THE Weather_App SHALL display a control that submits the entered City_Name.
3. WHEN the User submits a non-empty City_Name, THE Weather_App SHALL remove leading and trailing whitespace from the City_Name and pass the trimmed City_Name directly to the Geocoding_Service.
4. IF the User submits a City_Name that is empty or contains only whitespace, THEN THE Weather_App SHALL display a visible message requesting a City_Name within 1 second and SHALL NOT contact the Geocoding_Service.
5. IF the User submits a City_Name longer than 100 characters, THEN THE Weather_App SHALL display a visible message indicating the City_Name exceeds the allowed length within 1 second and SHALL NOT contact the Geocoding_Service.
6. THE Weather_App SHALL NOT store or hardcode any City_Name values in the application code.

### Requirement 2: Convert City Name to Coordinates

**User Story:** As a user, I want my city name converted to a location, so that weather can be looked up for the correct place.

#### Acceptance Criteria

1. WHEN the Weather_App receives a City_Name containing at least one non-whitespace character and no more than 200 characters, THE Weather_App SHALL request Coordinates from the Geocoding_Service using the City_Name.
2. IF the Weather_App receives a City_Name that is empty or contains only whitespace characters, THEN THE Weather_App SHALL display a message indicating a city name is required and SHALL NOT request Coordinates from the Geocoding_Service.
3. WHEN the Geocoding_Service returns at least one matching location, THE Weather_App SHALL use the Coordinates of the first returned location for the weather lookup.
4. IF the Geocoding_Service returns no matching location for the City_Name, THEN THE Weather_App SHALL display a message indicating the City_Name was not found and SHALL NOT proceed with the weather lookup.
5. IF the request to the Geocoding_Service returns an error response or does not complete within 10 seconds, THEN THE Weather_App SHALL display a message indicating the location lookup failed and SHALL retain the City_Name entered by the user.

### Requirement 3: Display Current Conditions and 5-Day Forecast

**User Story:** As a user, I want to see current weather conditions and a 5-day forecast for the city I entered, with weather icons, so that I know the current and upcoming weather there.

#### Acceptance Criteria

1. WHEN the Weather_App obtains Coordinates for the City_Name, THE Weather_App SHALL request Weather_Conditions and the Forecast from the Weather_Service using the Coordinates.
2. WHEN the Weather_Service returns Weather_Conditions containing a temperature value, THE Weather_App SHALL display the current temperature for the City_Name in degrees Fahrenheit rounded to the nearest whole degree with a Fahrenheit unit label.
3. WHEN the Weather_Service returns Weather_Conditions containing a textual forecast, THE Weather_App SHALL display the textual forecast description and a Weather_Icon corresponding to that textual forecast for the City_Name.
4. WHEN the Weather_Service returns a Forecast, THE Weather_App SHALL display the next 5 days of the Forecast in a table, where each row shows the day, the temperature, the short textual condition, and a Weather_Icon corresponding to that condition.
5. IF the Weather_Service returns Weather_Conditions or a Forecast that do not contain a temperature value or a textual forecast, THEN THE Weather_App SHALL display a message indicating current weather conditions are unavailable for the City_Name.
6. IF the request to the Weather_Service does not return a response within 10 seconds, or returns a failure response, THEN THE Weather_App SHALL display a message indicating the weather lookup failed.

### Requirement 4: Display Status During Lookup

**User Story:** As a user, I want feedback while my request is processing, so that I know the application is working.

#### Acceptance Criteria

1. WHEN the User submits a non-empty City_Name, THE Weather_App SHALL enter the lookup-in-progress state spanning the Geocoding_Service request and the Weather_Service request.
2. WHILE the lookup-in-progress state is active, THE Weather_App SHALL display a single status message indicating that the lookup is in progress.
3. WHEN a weather lookup completes successfully, THE Weather_App SHALL remove the in-progress status message and display the Weather_Conditions in its place.
4. WHEN a weather lookup completes with an error, THE Weather_App SHALL remove the in-progress status message and display the corresponding error message defined for that failure in Requirement 2 or Requirement 3 in its place.
5. THE Weather_App SHALL display at most one status at a time, being either the in-progress status message, the Weather_Conditions, or an error message.
6. IF the User submits an empty City_Name, THEN THE Weather_App SHALL NOT enter the lookup-in-progress state and SHALL NOT display the in-progress status message.

### Requirement 5: Serve the Application Locally

**User Story:** As a developer, I want to run the application locally with a script, so that I can use it in a browser without manual setup.

#### Acceptance Criteria

1. WHEN the Startup_Script is run, THE Startup_Script SHALL start the HTTP_Server serving the Weather_App at `http://localhost:8080`.
2. WHEN the HTTP_Server receives a request for an existing Weather_App HTML or JavaScript file, THE HTTP_Server SHALL serve the requested file over HTTP.
3. WHEN the HTTP_Server receives a request for a file that does not exist, THE HTTP_Server SHALL return a response indicating the file was not found.
4. WHEN the HTTP_Server has started successfully, THE Startup_Script SHALL display a message indicating that the Weather_App is available at `http://localhost:8080`.
5. IF the HTTP_Server cannot start because `localhost:8080` is already in use, THEN THE Startup_Script SHALL display a message indicating the port is unavailable and SHALL NOT serve the Weather_App.
6. WHERE path-related issues prevent the PowerShell Startup_Script from starting the HTTP_Server, THE project SHALL provide a batch script that starts the HTTP_Server at `http://localhost:8080`.
