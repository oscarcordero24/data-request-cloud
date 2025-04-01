
// Fetch Json Data
export function fetchJsonFile(urlToFetch, sucessFunction, errorFunction=function(){console.log("There was an error getting the data.")}){
    fetch(urlToFetch, {
        method: 'GET',
        headers: {
            'Accept': 'application/json;version=2'
        },
    })
    .then(response => {
        if (!response.ok) {
            console.log(response)
            throw new Error('Network response was not ok ' + response.statusText);
        }
        return response.json();
    })
    .then(data => {
        sucessFunction(data);
    })    
    .catch(error => {
        console.error('There has been a problem with your fetch operation:', error);
        errorFunction(error);
    })
}

// Fetch Json Data
export function fetchJsonFileV01(urlToFetch, sucessFunction, errorFunction=function(){console.log("There was an error getting the data.")}){
    fetch(urlToFetch)
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok ' + response.statusText);
        }
        return response.json();
    })
    .then(data => {
        sucessFunction(data);
    })    
    .catch(error => {
        console.error('There has been a problem with your fetch operation:', error);
        errorFunction(error);
    })
}

// Function to convert UTC to Central
export function convertUTCtoCentralTime(data) {
    // Return null if data is null
    if (data === null) {
        return null;
    }
 
    // Define the Central Time timezone
    const centralTimeZone = 'America/Chicago';
 
    // Helper function to convert a UTC timestamp to Central Time
    function convertTimestampToCentralTime(timestamp) {
        // Create a Date object from the UTC timestamp
        const utcDate = new Date(timestamp);
 
        // Convert the UTC date to Central Time
        const centralDate = new Date(utcDate.toLocaleString('en-US', { timeZone: centralTimeZone }));
 
        return centralDate;
    }
 
    // Create a copy of the data object to avoid mutating the original
    const convertedData = JSON.parse(JSON.stringify(data));
 
    // Iterate over the values array and convert each timestamp
    convertedData.values = convertedData.values.map(valueArray => {
        const [timestamp, ...rest] = valueArray;
        const centralDate = convertTimestampToCentralTime(timestamp);
        return [centralDate, ...rest];
    });
 
    return convertedData;
}
