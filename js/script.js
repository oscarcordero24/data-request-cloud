import {
    fetchJsonFile,
    fetchJsonFileV01,
    convertUTCtoCentralTime
} from '../../js/requestData.js';
import {
    blurBackground,
    getNames,
    popupMessage,
    addBasinNames,
    haveOneYearOfData,
    showLoading,
    formatDate
} from './functions.js';


// Web site app information
const appMetadata = {
    name: "Data Request",
    description: "An interactive platform for accessing real-time and historical data on river gages and basins.",
    author: "U.S. Army Corps of Engineers, St. Louis District",
    version: "1.0",
    contact: {
        email: "dll-cemvs-water-managers@usace.army.mil",
        website: "https://www.mvs-wc.usace.army.mil/"
    }
}


// Manually set up Maintenance
let isMaintenance = false;

let params = new URLSearchParams(window.location.search);
let isDeveloper = params.get("developer") ? params.get("developer").toLowerCase() : null;

if (isDeveloper === "true"){
    isMaintenance = false;
}

let domain = "https://coe-mvsuwa04mvs.mvs.usace.army.mil:8243/mvs-data";
//let  = domain + "/timeseries?" + name=Mt%20Vernon-Big%20Muddy.Stage.Inst.15Minutes.0.lrgsShef-rev&office=MVS&begin=2024-01-01T00%3A00%3A00.00Z&end=2024-12-31T23%3A59%3A59.59Z&timezone=CST6CDT

// Change Value to Stage29[ft] --> Need to find out if the gage is a project **IMPORTANT**

// Const Elements
const basinName = document.getElementById('basinCombobox'),
      gageName = document.getElementById('gageCombobox'),
      beginDate = document.getElementById('begin-input'),
      endDate = document.getElementById('end-input'),
      PORBeginDate = document.querySelector('#info-table .por-start'),
      POREndDate = document.querySelector('#info-table .por-end'),
      darkModeCheckbox = document.querySelector('.header label input'),
      popupWindowBtn = document.getElementById('popup-button'),
      getDataBtn = document.getElementById('button-data'),
      getBasinDataBtn = document.getElementById('button-data-basin'),
      getExcelBtn = document.getElementById('button-csv'),
      getJSONBtn = document.getElementById('button-json'),
      basinExcelBtn = document.getElementById('button-basin-excel'),
      basinJSONBtn = document.getElementById('button-basin-json'),
      instructionBtn = document.getElementById('button-instructions'),
      dailyCheckbox = document.getElementById('daily'),
      hourlyCheckbox = document.getElementById('hourly'),
      loadingDiv = document.getElementById('loading-div'),
      dataTable = document.getElementById('data-table'),
      metadataDiv = document.querySelector('.results .metadata-div'),
      metadataTitle = document.querySelector('.results .metadata-div .metadata-title'),
      metadataDescription = document.querySelector('.results .metadata-div .metadata-description'),
      metadataDatum88 = document.querySelector('.results .metadata-div .metadata-datum-88'),
      metadataRecordedTime = document.querySelector('.results .metadata-div .metadata-recorded-time'),
      metadataPeriodOfRecord = document.querySelector('.results .metadata-div .metadata-period-of-record'),
      metadataMissingDates = document.querySelector('.results .metadata-div .metadata-missing-dates'),
      metadataHighlightValues = document.querySelector('.results .metadata-div .metadata-highlight-values'),
      tableResultsDiv = document.querySelector('.results .table-results'),
      tableStageTitleText = document.getElementById('table-stage-title'),
      tableTBody = document.getElementById('table-tbody'),
      isProjectText = document.getElementById('is-project'),
      importantMessageDiv = document.getElementById('important-messages'),
      importantMessageText = document.querySelector('#important-messages .message-text'),
      errorMessageDiv = document.getElementById('error-messages'),
      errorMessageText = document.querySelector('#error-messages .message-text'),
      instructionsDiv = document.getElementById('instructions'),
      missingDateWindowCloseBtn = document.getElementById('close-btn'),
      missingDateWindow = document.getElementById('missing-dates-table'),
      missingDateTableBody = document.querySelector('#missing-dates-table table tbody'),
      progressBar = document.getElementById('progress'),
      progressBarDiv = document.getElementById('progress-bar-div'),
      progressBarText = document.querySelector('#progress-bar-div .progress-bar-text');


let fetchedData = [];
let globalData = [];
let globalFormattedData = [];
let globalGageList = [];
let pageURL = "";
let gageMetadata = [];
const disclamerText = "NOTICE: All data contained herein is preliminary in nature and therefore subject to change. The data is for general information purposes ONLY and SHALL NOT be used in technical applications such as, but not limited to, studies or designs. All critical data should be obtained from and verified by the United States Army Corps of Engineers. The United States Government assumes no liability for the completeness or accuracy of the data contained herein and any use of such data inconsistent with this disclaimer shall be solely at the risk of the user.";

errorMessageText.textContent = "Oops, something went wrong! Please try refreshing the page and attempting again. If the problem persists, feel free to contact Water Control for assistance. We apologize for the inconvenience!";

let previousGage;
let haveGageData = false;
let haveBasinData = false;
let refreshPage = true;
let paintRow;

let userData = loadUserData();

getBasinDataBtn.disabled = true;

if (isMaintenance){

    window.location.href = "../../html/maintenance.html";

} else {

    if (userData == null || userData.length < 1) {

        userData = {
            darkMode: darkModeCheckbox.checked,
        };
    } else {
        applyDarkMode();
        darkModeCheckbox.checked = userData.darkMode;
    }

    try{
        document.addEventListener('DOMContentLoaded', async function () {
            // Display the loading indicator for water quality alarm
            //const loadingIndicator = document.getElementById('loading_alarm_datman');
            //loadingIndicator.style.display = 'block'; // Show the loading indicator
        
            // Disable all elements until the page is fully loaded
            disableButtons();
            disableFilesBtns();
            disableBasinFilesBtns();
        
            // Set the category and base URL for API calls
            let setCategory = "Datman"; // 'Stage' for hourly
        
            let cda = "internal";
            let office = "MVS";
            let type = "no idea";
        
            // Get the current date and time, and compute a "look-back" time for historical data
            const currentDateTime = new Date();
            const lookBackHours = subtractDaysFromDate(new Date(), 90);
        
            let setBaseUrl = null;
            if (cda === "internal") {
                setBaseUrl = `https://coe-${office.toLowerCase()}uwa04${office.toLowerCase()}.${office.toLowerCase()}.usace.army.mil:8243/${office.toLowerCase()}-data/`;
                console.log("setBaseUrl: ", setBaseUrl);
            } else if (cda === "public") {
                setBaseUrl = `https://cwms-data.usace.army.mil/cwms-data/`;
                console.log("setBaseUrl: ", setBaseUrl);
            }
        
            // Define the URL to fetch location groups based on category
            const categoryApiUrl = setBaseUrl + `location/group?office=${office}&include-assigned=false&location-category-like=${setCategory}`;
            console.log("categoryApiUrl: ", categoryApiUrl);
        
            // Initialize maps to store metadata and time-series ID (TSID) data for various parameters
            const metadataMap = new Map();
            const ownerMap = new Map();
            const tsidDatmanMap = new Map();
            const tsidStageMap = new Map();
            const projectMap = new Map();
        
            // Initialize arrays for storing promises
            const metadataPromises = [];
            const ownerPromises = [];
            const datmanTsidPromises = [];
            const stageTsidPromises = [];
            const projectPromises = [];
        
            // Fetch location group data from the API
            fetch(categoryApiUrl)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json();
                })
                .then(data => {
                    if (!Array.isArray(data) || data.length === 0) {
                        console.warn('No data available from the initial fetch.');
                        return;
                    }
        
                    // Filter and map the returned data to basins belonging to the target category
                    const targetCategory = { "office-id": office, "id": setCategory };
                    const filteredArray = filterByLocationCategory(data, targetCategory);
                    const basins = filteredArray.map(item => item.id);
        
                    if (basins.length === 0) {
                        console.warn('No basins found for the given category.');
                        return;
                    }
        
                    // Initialize an array to store promises for fetching basin data
                    const apiPromises = [];
                    const combinedData = [];
        
                    // Loop through each basin and fetch data for its assigned locations
                    basins.forEach(basin => {
                        const basinApiUrl = setBaseUrl + `location/group/${basin}?office=${office}&category-id=${setCategory}`;
                        console.log("basinApiUrl: ", basinApiUrl);
        
                        apiPromises.push(
                            fetch(basinApiUrl)
                                .then(response => {
                                    if (!response.ok) {
                                        throw new Error(`Network response was not ok for basin ${basin}: ${response.statusText}`);
                                    }
                                    return response.json();
                                })
                                .then(getBasin => {
                                    // console.log('getBasin:', getBasin);
        
                                    if (!getBasin) {
                                        console.log(`No data for basin: ${basin}`);
                                        return;
                                    }
        
                                    // Filter and sort assigned locations based on 'attribute' field
                                    getBasin[`assigned-locations`] = getBasin[`assigned-locations`].filter(location => location.attribute <= 900);
                                    getBasin[`assigned-locations`].sort((a, b) => a.attribute - b.attribute);
                                    combinedData.push(getBasin);
        
                                    // If assigned locations exist, fetch metadata and time-series data
                                    if (getBasin['assigned-locations']) {
                                        getBasin['assigned-locations'].forEach(loc => {
                                            // console.log(loc['location-id']);
        
                                            // Fetch metadata for each location
                                            const locApiUrl = setBaseUrl + `locations/${loc['location-id']}?office=${office}`;
                                            // console.log("locApiUrl: ", locApiUrl);
                                            metadataPromises.push(
                                                fetch(locApiUrl)
                                                    .then(response => {
                                                        if (response.status === 404) {
                                                            console.warn(`Location metadata not found for location: ${loc['location-id']}`);
                                                            return null; // Skip if not found
                                                        }
                                                        if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
                                                        return response.json();
                                                    })
                                                    .then(locData => {
                                                        if (locData) {
                                                            metadataMap.set(loc['location-id'], locData);
                                                        }
                                                    })
                                                    .catch(error => {
                                                        console.error(`Problem with the fetch operation for location ${loc['location-id']}:`, error);
                                                    })
                                            );
        
                                            // Fetch owner for each location
                                            let ownerApiUrl = setBaseUrl + `location/group/${office}?office=${office}&category-id=${office}`;
                                            if (ownerApiUrl) {
                                                ownerPromises.push(
                                                    fetch(ownerApiUrl)
                                                        .then(response => {
                                                            if (response.status === 404) {
                                                                console.warn(`Temp-Water TSID data not found for location: ${loc['location-id']}`);
                                                                return null;
                                                            }
                                                            if (!response.ok) {
                                                                throw new Error(`Network response was not ok: ${response.statusText}`);
                                                            }
                                                            return response.json();
                                                        })
                                                        .then(ownerData => {
                                                            if (ownerData) {
                                                                console.log("ownerData", ownerData);
                                                                ownerMap.set(loc['location-id'], ownerData);
                                                            }
                                                        })
                                                        .catch(error => {
                                                            console.error(`Problem with the fetch operation for stage TSID data at ${ownerApiUrl}:`, error);
                                                        })
                                                );
                                            }
        
        
                                            // Fetch project for each location
                                            let projectApiUrl = setBaseUrl + `location/group/Project?office=${office}&category-id=${office}`;
                                            if (projectApiUrl) {
                                                projectPromises.push(
                                                    fetch(projectApiUrl)
                                                        .then(response => {
                                                            if (response.status === 404) {
                                                                console.warn(`Temp-Water TSID data not found for location: ${loc['location-id']}`);
                                                                return null;
                                                            }
                                                            if (!response.ok) {
                                                                throw new Error(`Network response was not ok: ${response.statusText}`);
                                                            }
                                                            return response.json();
                                                        })
                                                        .then(projectData => {
                                                            console.log("Promise Data: ", projectData);
                                                            if (projectData) {
                                                                projectMap.set(loc['location-id'], projectData);
                                                            }
                                                        })
                                                        .catch(error => {
                                                            console.error(`Problem with the fetch operation for stage TSID data at ${projectApiUrl}:`, error);
                                                        })
                                                );
                                            };
        
        
                                            // Fetch datman TSID data
                                            const tsidDatmanApiUrl = setBaseUrl + `timeseries/group/Datman?office=${office}&category-id=${loc['location-id']}`;
                                            // console.log('tsidDatmanApiUrl:', tsidDatmanApiUrl);
                                            datmanTsidPromises.push(
                                                fetch(tsidDatmanApiUrl)
                                                    .then(response => {
                                                        if (response.status === 404) return null; // Skip if not found
                                                        if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
                                                        return response.json();
                                                    })
                                                    .then(tsidDatmanData => {
                                                        // console.log('tsidDatmanData:', tsidDatmanData);
                                                        if (tsidDatmanData) {
                                                            tsidDatmanMap.set(loc['location-id'], tsidDatmanData);
                                                        }
                                                    })
                                                    .catch(error => {
                                                        console.error(`Problem with the fetch operation for stage TSID data at ${tsidDatmanApiUrl}:`, error);
                                                    })
                                            );
        
                                            // Fetch stage TSID data
                                            const tsidStageApiUrl = setBaseUrl + `timeseries/group/Datman-Stage?office=${office}&category-id=${loc['location-id']}`;
                                            // console.log('tsidDatmanApiUrl:', tsidDatmanApiUrl);
                                            stageTsidPromises.push(
                                                fetch(tsidStageApiUrl)
                                                    .then(response => {
                                                        if (response.status === 404) return null; // Skip if not found
                                                        if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
                                                        return response.json();
                                                    })
                                                    .then(tsidStageData => {
                                                        // console.log('tsidDatmanData:', tsidDatmanData);
                                                        if (tsidStageData) {
                                                            tsidStageMap.set(loc['location-id'], tsidStageData);
                                                        }
                                                    })
                                                    .catch(error => {
                                                        console.error(`Problem with the fetch operation for stage TSID data at ${tsidStageApiUrl}:`, error);
                                                    })
                                            );
                                        });
                                    }
                                })
                                .catch(error => {
                                    console.error(`Problem with the fetch operation for basin ${basin}:`, error);
                                })
                        );
                    });
        
                    // Process all the API calls and store the fetched data
                    Promise.all(apiPromises)
                        .then(() => Promise.all(metadataPromises))
                        .then(() => Promise.all(ownerPromises))
                        .then(() => Promise.all(datmanTsidPromises))
                        .then(() => Promise.all(stageTsidPromises))
                        .then(() => Promise.all(projectPromises))
                        .then(() => {
                            combinedData.forEach(basinData => {
                                if (basinData['assigned-locations']) {
                                    basinData['assigned-locations'].forEach(loc => {
                                        // Add metadata, TSID, and last-value data to the location object
        
                                        // Add metadata to json
                                        const metadataMapData = metadataMap.get(loc['location-id']);
                                        if (metadataMapData) {
                                            loc['metadata'] = metadataMapData;
                                        }
        
                                        // Add owner to json
                                        const ownerMapData = ownerMap.get(loc['location-id']);
                                        if (ownerMapData) {
                                            loc['owner'] = ownerMapData;
                                        };
        
                                        // Add project to json
                                        const projectMapData = projectMap.get(loc['location-id']);
                                        if (projectMapData) {
                                            loc['project'] = projectMapData;
                                        };
        
                                        // Add datman to json
                                        const tsidDatmanMapData = tsidDatmanMap.get(loc['location-id']);
                                        if (tsidDatmanMapData) {
                                            reorderByAttribute(tsidDatmanMapData);
                                            loc['tsid-datman'] = tsidDatmanMapData;
                                        } else {
                                            loc['tsid-datman'] = null;  // Append null if missing
                                        }
        
                                        // Add stage to json
                                        const tsidStageMapData = tsidStageMap.get(loc['location-id']);
                                        if (tsidStageMapData) {
                                            reorderByAttribute(tsidStageMapData);
                                            loc['tsid-stage'] = tsidStageMapData;
                                        } else {
                                            loc['tsid-stage'] = null;  // Append null if missing
                                        }
        
        
                                        // Initialize empty arrays to hold API and last-value data for various parameters
                                        loc['datman-api-data'] = [];
                                        loc['datman-last-value'] = [];
                                    });
                                }
                            });
        
                            console.log('combinedData:', combinedData);
        
                            const timeSeriesDataPromises = [];
        
                            // Iterate over all arrays in combinedData
                            for (const dataArray of combinedData) {
                                for (const locData of dataArray['assigned-locations'] || []) {
                                    // Handle temperature, depth, and DO time series
                                    const datmanTimeSeries = locData['tsid-datman']?.['assigned-time-series'] || [];
                                    const stageTimeSeries = locData['tsid-stage']?.['assigned-time-series'] || [];
        
                                    // Function to create fetch promises for time series data
                                    const timeSeriesDataFetchPromises = (timeSeries, type) => {
                                        return timeSeries.map((series, index) => {
                                            const tsid = series['timeseries-id'];
                                            const timeSeriesDataApiUrl = setBaseUrl + `timeseries?name=${tsid}&begin=${lookBackHours.toISOString()}&end=${currentDateTime.toISOString()}&office=${office}`;
                                            console.log('timeSeriesDataApiUrl:', timeSeriesDataApiUrl);
        
                                            return fetch(timeSeriesDataApiUrl, {
                                                method: 'GET',
                                                headers: {
                                                    'Accept': 'application/json;version=2'
                                                }
                                            })
                                                .then(res => res.json())
                                                .then(data => {
                                                    if (data.values) {
                                                        data.values.forEach(entry => {
                                                            entry[0] = formatISODate2ReadableDate(entry[0]);
                                                        });
                                                    }
        
                                                    let apiDataKey;
                                                    if (type === 'datman') {
                                                        apiDataKey = 'datman-api-data'; // Assuming 'do-api-data' is the key for dissolved oxygen data
                                                    } else {
                                                        console.error('Unknown type:', type);
                                                        return; // Early return to avoid pushing data if type is unknown
                                                    }
        
                                                    locData[apiDataKey].push(data);
        
        
                                                    let lastValueKey;
                                                    if (type === 'datman') {
                                                        lastValueKey = 'datman-last-value';  // Assuming 'do-last-value' is the key for dissolved oxygen last value
                                                    } else {
                                                        console.error('Unknown type:', type);
                                                        return; // Early return if the type is unknown
                                                    }
        
                                                    let maxValueKey;
                                                    if (type === 'datman') {
                                                        maxValueKey = 'datman-max-value';
                                                    } else {
                                                        console.error('Unknown type:', type);
                                                        return; // Early return if the type is unknown
                                                    }
        
                                                    let minValueKey;
                                                    if (type === 'datman') {
                                                        minValueKey = 'datman-min-value';
                                                    } else {
                                                        console.error('Unknown type:', type);
                                                        return; // Early return if the type is unknown
                                                    }
        
                                                    if (!locData[lastValueKey]) {
                                                        locData[lastValueKey] = [];  // Initialize as an array if it doesn't exist
                                                    }
        
                                                    if (!locData[maxValueKey]) {
                                                        locData[maxValueKey] = [];  // Initialize as an array if it doesn't exist
                                                    }
        
                                                    if (!locData[minValueKey]) {
                                                        locData[minValueKey] = [];  // Initialize as an array if it doesn't exist
                                                    }
        
        
                                                    // Get and store the last non-null value for the specific tsid
                                                    const lastValue = getLastNonNullValue(data, tsid);
        
                                                    // Get and store the last max value for the specific tsid
                                                    const maxValue = getMaxValue(data, tsid);
                                                    // console.log("maxValue: ", maxValue);
        
                                                    // Get and store the last min value for the specific tsid
                                                    const minValue = getMinValue(data, tsid);
                                                    // console.log("minValue: ", minValue);
        
                                                    // Push the last non-null value to the corresponding last-value array
                                                    locData[lastValueKey].push(lastValue);
        
                                                    // Push the last non-null value to the corresponding last-value array
                                                    locData[maxValueKey].push(maxValue);
        
                                                    // Push the last non-null value to the corresponding last-value array
                                                    locData[minValueKey].push(minValue);
        
                                                })
        
                                                .catch(error => {
                                                    console.error(`Error fetching additional data for location ${locData['location-id']} with TSID ${tsid}:`, error);
                                                });
                                        });
                                    };
        
        
                                    // Create promises for temperature, depth, and DO time series
                                    const datmanPromises = timeSeriesDataFetchPromises(datmanTimeSeries, 'datman');
        
                                    // Additional API call for extents data
                                    const timeSeriesDataExtentsApiCall = (type) => {
                                        const extentsApiUrl = setBaseUrl + `catalog/TIMESERIES?page-size=5000&office=${office}`;
                                        console.log('extentsApiUrl:', extentsApiUrl);
        
                                        return fetch(extentsApiUrl, {
                                            method: 'GET',
                                            headers: {
                                                'Accept': 'application/json;version=2'
                                            }
                                        })
                                            .then(res => res.json())
                                            .then(data => {
                                                locData['extents-api-data'] = data;
                                                locData[`extents-data`] = {}
        
                                                // Collect TSIDs from temp, depth, and DO time series
                                                const datmanTids = datmanTimeSeries.map(series => series['timeseries-id']);
                                                const stageTids = stageTimeSeries.map(series => series['timeseries-id']);
                                                const allTids = [...datmanTids, ...stageTids]; // Combine both arrays
        
                                                // Iterate over all TSIDs and create extents data entries
                                                allTids.forEach((tsid, index) => {
                                                    // console.log("tsid:", tsid);
                                                    const matchingEntry = data.entries.find(entry => entry['name'] === tsid);
                                                    if (matchingEntry) {
                                                        // Construct dynamic key
                                                        let _data = {
                                                            office: matchingEntry.office,
                                                            name: matchingEntry.name,
                                                            earliestTime: matchingEntry.extents[0]?.['earliest-time'],
                                                            lastUpdate: matchingEntry.extents[0]?.['last-update'],
                                                            latestTime: matchingEntry.extents[0]?.['latest-time'],
                                                            tsid: matchingEntry['timeseries-id'], // Include TSID for clarity
                                                        };
                                                        // console.log({ locData })
                                                        // Determine extent key based on tsid
                                                        let extent_key;
                                                        if (tsid.includes('Stage') || tsid.includes('Elev') || tsid.includes('Flow')) { // Example for another condition
                                                            extent_key = 'datman';
                                                        } else {
                                                            return; // Ignore if it doesn't match either condition
                                                        }
                                                        // locData['tsid-extens-data']['temp-water'][0]
                                                        if (!locData[`extents-data`][extent_key])
                                                            locData[`extents-data`][extent_key] = [_data]
                                                        else
                                                            locData[`extents-data`][extent_key].push(_data)
        
                                                    } else {
                                                        console.warn(`No matching entry found for TSID: ${tsid}`);
                                                    }
                                                });
                                            })
                                            .catch(error => {
                                                console.error(`Error fetching additional data for location ${locData['location-id']}:`, error);
                                            });
                                    };
        
                                    // Combine all promises for this location
                                    timeSeriesDataPromises.push(Promise.all([...datmanPromises, timeSeriesDataExtentsApiCall()]));
                                }
                            }
        
                            // Wait for all additional data fetches to complete
                            return Promise.all(timeSeriesDataPromises);
        
                        })
                        .then(() => {
                            console.log('All combinedData data fetched successfully:', combinedData);
        
                            // Check and remove all attribute ending in 0.1
                            combinedData.forEach((dataObj, index) => {
                                // console.log(`Processing dataObj at index ${index}:`, dataObj[`assigned-locations`]);
        
                                // Filter out locations where the 'attribute' ends with '.1'
                                dataObj[`assigned-locations`] = dataObj[`assigned-locations`].filter(location => {
                                    const attribute = location[`attribute`].toString();
                                    // console.log(`Checking attribute: ${attribute}`);
                                    return !attribute.endsWith('.1');
                                });
        
                                // console.log(`Updated assigned-locations for index ${index}:`, dataObj[`assigned-locations`]);
                            });
        
                            console.log('All combinedData data filtered successfully:', combinedData);
        
                            if (type === "status") {
                                // Only call createTable if no valid data exists
                                const table = createTable(combinedData);
        
                                // Append the table to the specified container
                                const container = document.getElementById('table_container_alarm_datman');
                                container.appendChild(table);
                            } else {
                                // Check if there are valid lastDatmanValues in the data
                                if (hasLastValue(combinedData)) {
                                    // if (hasDataSpike(combinedData)) {
                                    //     console.log("Data spike detected.");
                                    //     // call createTable if data spike exists
                                    //     const table = createTableDataSpike(combinedData);
        
                                    //     // Append the table to the specified container
                                    //     const container = document.getElementById('table_container_alarm_datman');
                                    //     container.appendChild(table);
                                    // } else {
                                    //     console.log("No data spikes detected.");
                                    //     console.log('Valid lastDatmanValue found. Displaying image instead.');
        
                                    //     // Create an img element
                                    //     const img = document.createElement('img');
                                    //     img.src = '/apps/alarms/images/passed.png'; // Set the image source
                                    //     img.alt = 'Process Completed'; // Optional alt text for accessibility
                                    //     img.style.width = '50px'; // Optional: set the image width
                                    //     img.style.height = '50px'; // Optional: set the image height
        
                                    //     // Get the container and append the image
                                    //     //const container = document.getElementById('table_container_alarm_datman');
                                    //     //container.appendChild(img);
                                    // }
        
                                } else {
                                    // Only call createTable if no valid data exists
                                    const table = createTable(combinedData);
        
                                    // Append the table to the specified container
                                    //const container = document.getElementById('table_container_alarm_datman');
                                    //container.appendChild(table);
                                }
                            }
        
                            //loadingIndicator.style.display = 'none';
                            console.log("TEST: ", combinedData);

                            try{
                                getBasinDataBtn.disabled = true;
                                initialize(combinedData);
                                disableButtons();
                            } catch (error){
                                console.error(error);
                                errorMessageDiv.classList.add("show");
                            } finally {
                                loadingDiv.classList.remove('show');
                            }
        
                            
        
                        })
                        .catch(error => {
                            console.error('There was a problem with one or more fetch operations:', error);
                            //loadingIndicator.style.display = 'none';
                        });
        
                })
                .catch(error => {
                    console.error('There was a problem with the initial fetch operation:', error);
                    //loadingIndicator.style.display = 'none';
                });
        
            function filterByLocationCategory(array, setCategory) {
                return array.filter(item =>
                    item['location-category'] &&
                    item['location-category']['office-id'] === setCategory['office-id'] &&
                    item['location-category']['id'] === setCategory['id']
                );
            }
        
            function subtractHoursFromDate(date, hoursToSubtract) {
                return new Date(date.getTime() - (hoursToSubtract * 60 * 60 * 1000));
            }
        
            function subtractDaysFromDate(date, daysToSubtract) {
                return new Date(date.getTime() - (daysToSubtract * 24 * 60 * 60 * 1000));
            }
        
            function formatISODate2ReadableDate(timestamp) {
                const date = new Date(timestamp);
                const mm = String(date.getMonth() + 1).padStart(2, '0'); // Month
                const dd = String(date.getDate()).padStart(2, '0'); // Day
                const yyyy = date.getFullYear(); // Year
                const hh = String(date.getHours()).padStart(2, '0'); // Hours
                const min = String(date.getMinutes()).padStart(2, '0'); // Minutes
                return `${mm}-${dd}-${yyyy} ${hh}:${min}`;
            }
        
            const reorderByAttribute = (data) => {
                data['assigned-time-series'].sort((a, b) => a.attribute - b.attribute);
            };
        
            const formatTime = (date) => {
                const pad = (num) => (num < 10 ? '0' + num : num);
                return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
            };
        
            const findValuesAtTimes = (data) => {
                const result = [];
                const currentDate = new Date();
        
                // Create time options for 5 AM, 6 AM, and 7 AM today in Central Standard Time
                const timesToCheck = [
                    new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 6, 0), // 6 AM CST
                    new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 5, 0), // 5 AM CST
                    new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 7, 0)  // 7 AM CST
                ];
        
                const foundValues = [];
        
                // Iterate over the values in the provided data
                const values = data.values;
        
                // Check for each time in the order of preference
                timesToCheck.forEach((time) => {
                    // Format the date-time to match the format in the data
                    const formattedTime = formatTime(time);
                    // console.log(formattedTime);
        
                    const entry = values.find(v => v[0] === formattedTime);
                    if (entry) {
                        foundValues.push({ time: formattedTime, value: entry[1] }); // Store both time and value if found
                    } else {
                        foundValues.push({ time: formattedTime, value: null }); // Store null if not found
                    }
                });
        
                // Push the result for this data entry
                result.push({
                    name: data.name,
                    values: foundValues // This will contain the array of { time, value } objects
                });
        
                return result;
            };
        
            function getLastNonNullValue(data, tsid) {
                // Iterate over the values array in reverse
                for (let i = data.values.length - 1; i >= 0; i--) {
                    // Check if the value at index i is not null
                    if (data.values[i][1] !== null) {
                        // Return the non-null value as separate variables
                        return {
                            tsid: tsid,
                            timestamp: data.values[i][0],
                            value: data.values[i][1],
                            qualityCode: data.values[i][2]
                        };
                    }
                }
                // If no non-null value is found, return null
                return null;
            }
        
            function getMaxValue(data, tsid) {
                let maxValue = -Infinity; // Start with the smallest possible value
                let maxEntry = null; // Store the corresponding max entry (timestamp, value, quality code)
        
                // Loop through the values array
                for (let i = 0; i < data.values.length; i++) {
                    // Check if the value at index i is not null
                    if (data.values[i][1] !== null) {
                        // Update maxValue and maxEntry if the current value is greater
                        if (data.values[i][1] > maxValue) {
                            maxValue = data.values[i][1];
                            maxEntry = {
                                tsid: tsid,
                                timestamp: data.values[i][0],
                                value: data.values[i][1],
                                qualityCode: data.values[i][2]
                            };
                        }
                    }
                }
        
                // Return the max entry (or null if no valid values were found)
                return maxEntry;
            }
        
            function getMinValue(data, tsid) {
                let minValue = Infinity; // Start with the largest possible value
                let minEntry = null; // Store the corresponding min entry (timestamp, value, quality code)
        
                // Loop through the values array
                for (let i = 0; i < data.values.length; i++) {
                    // Check if the value at index i is not null
                    if (data.values[i][1] !== null) {
                        // Update minValue and minEntry if the current value is smaller
                        if (data.values[i][1] < minValue) {
                            minValue = data.values[i][1];
                            minEntry = {
                                tsid: tsid,
                                timestamp: data.values[i][0],
                                value: data.values[i][1],
                                qualityCode: data.values[i][2]
                            };
                        }
                    }
                }
        
                // Return the min entry (or null if no valid values were found)
                return minEntry;
            }
        
            function hasLastValue(data) {
                let allLocationsValid = true; // Flag to track if all locations are valid
        
                // Iterate through each key in the data object
                for (const locationIndex in data) {
                    if (data.hasOwnProperty(locationIndex)) { // Ensure the key belongs to the object
                        const item = data[locationIndex];
                        // console.log(`Checking basin ${parseInt(locationIndex) + 1}:`, item); // Log the current item being checked
        
                        const assignedLocations = item['assigned-locations'];
                        // Check if assigned-locations is an object
                        if (typeof assignedLocations !== 'object' || assignedLocations === null) {
                            console.log('No assigned-locations found in basin:', item);
                            allLocationsValid = false; // Mark as invalid since no assigned locations are found
                            continue; // Skip to the next basin
                        }
        
                        // Iterate through each location in assigned-locations
                        for (const locationName in assignedLocations) {
                            const location = assignedLocations[locationName];
                            // console.log(`Checking location: ${locationName}`, location); // Log the current location being checked
        
                            // Check if location['tsid-temp-water'] exists, if not, set tempWaterTsidArray to an empty array
                            const datmanTsidArray = (location['tsid-datman'] && location['tsid-datman']['assigned-time-series']) || [];
                            const datmanLastValueArray = location['datman-last-value'];
                            // console.log("datmanTsidArray: ", datmanTsidArray);
                            // console.log("datmanLastValueArray: ", datmanLastValueArray);
        
                            // Check if 'datman-last-value' exists and is an array
                            let hasValidValue = false;
        
                            if (Array.isArray(datmanTsidArray) && datmanTsidArray.length > 0) {
                                // console.log('datmanTsidArray has data.');
        
                                // Loop through the datmanLastValueArray and check for null or invalid entries
                                for (let i = 0; i < datmanLastValueArray.length; i++) {
                                    const entry = datmanLastValueArray[i];
                                    // console.log("Checking entry: ", entry);
        
                                    // Step 1: If the entry is null, set hasValidValue to false
                                    if (entry === null) {
                                        // console.log(`Entry at index ${i} is null and not valid.`);
                                        hasValidValue = false;
                                        continue; // Skip to the next iteration, this is not valid
                                    }
        
                                    // Step 2: If the entry exists, check if the value is valid
                                    if (entry.value !== null && entry.value !== 'N/A' && entry.value !== undefined) {
                                        // console.log(`Valid entry found at index ${i}:`, entry);
                                        hasValidValue = true; // Set to true only if we have a valid entry
                                    } else {
                                        console.log(`Entry at index ${i} has an invalid value:`, entry.value);
                                        hasValidValue = false; // Invalid value, so set it to false
                                    }
                                }
        
                                // Log whether a valid entry was found
                                if (hasValidValue) {
                                    // console.log("There are valid entries in the array.");
                                } else {
                                    // console.log("No valid entries found in the array.");
                                }
                            } else {
                                console.log(`datmanTsidArray is either empty or not an array for location ${locationName}.`);
                            }
        
                            // If no valid values found in the current location, mark as invalid
                            if (!hasValidValue) {
                                allLocationsValid = false; // Set flag to false if any location is invalid
                            }
                        }
                    }
                }
        
                // Return true only if all locations are valid
                if (allLocationsValid) {
                    console.log('All locations have valid entries.');
                    return true;
                } else {
                    // console.log('Some locations are missing valid entries.');
                    return false;
                }
            }
        
            function hasDataSpikeInApiDataArray(data) {
                // Iterate through each key in the data object
                for (const locationIndex in data) {
                    if (data.hasOwnProperty(locationIndex)) { // Ensure the key belongs to the object
                        const item = data[locationIndex];
                        // console.log(`Checking basin ${parseInt(locationIndex) + 1}:`, item); // Log the current item being checked
        
                        const assignedLocations = item['assigned-locations'];
                        // Check if assigned-locations is an object
                        if (typeof assignedLocations !== 'object' || assignedLocations === null) {
                            console.log('No assigned-locations found in basin:', item);
                            continue; // Skip to the next basin
                        }
        
                        // Iterate through each location in assigned-locations
                        for (const locationName in assignedLocations) {
                            const location = assignedLocations[locationName];
                            // console.log(`Checking location: ${locationName}`, location); // Log the current location being checked
        
                            const datmanApiData = location['datman-api-data'];
        
                            // Check if 'datman-api-data' exists and has a 'values' array
                            if (Array.isArray(datmanApiData) && datmanApiData.length > 0) {
                                let maxValue = -Infinity; // Initialize to a very low value
                                let minValue = Infinity; // Initialize to a very high value
        
                                // Iterate through the 'values' array and find the max and min values
                                datmanApiData[0]['values'].forEach(valueEntry => {
                                    const currentValue = parseFloat(valueEntry[1]);
                                    if (!isNaN(currentValue)) {
                                        maxValue = Math.max(maxValue, currentValue);
                                        minValue = Math.min(minValue, currentValue);
                                    }
                                });
        
                                // Log the max and min values for the location
                                // console.log(`Max value for location ${locationName}:`, maxValue);
                                // console.log(`Min value for location ${locationName}:`, minValue);
        
                                // Check if the max value exceeds 999 or the min value is less than -999
                                if (maxValue > 999 || minValue < -999) {
                                    // console.log(`Data spike detected in location ${locationName}: max = ${maxValue}, min = ${minValue}`);
                                    return true; // Return true if any spike is found
                                }
                            } else {
                                console.log(`No valid 'datman-api-data' found in location ${locationName}.`);
                            }
                        }
                    }
                }
        
                // Return false if no data spikes were found
                console.log('No data spikes detected in any location.');
                return false;
            }
        
            function hasDataSpike(data) {
                // Iterate through each key in the data object
                for (const locationIndex in data) {
                    if (data.hasOwnProperty(locationIndex)) { // Ensure the key belongs to the object
                        const item = data[locationIndex];
                        console.log(`Checking basin ${parseInt(locationIndex) + 1}:`, item); // Log the current item being checked
        
                        const assignedLocations = item['assigned-locations'];
                        // Check if assigned-locations is an object
                        if (typeof assignedLocations !== 'object' || assignedLocations === null) {
                            console.log('No assigned-locations found in basin:', item);
                            continue; // Skip to the next basin
                        }
        
                        // Iterate through each location in assigned-locations
                        for (const locationName in assignedLocations) {
                            const location = assignedLocations[locationName];
                            console.log(`Checking location: ${locationName}`, location); // Log the current location being checked
                            const datmanMaxValue = location['datman-max-value'][0][`value`];
                            const datmanMinValue = location['datman-min-value'][0][`value`];
        
                            // Check if datmanMaxValue or datmanMinValue exists
                            if (datmanMaxValue || datmanMinValue) {
                                // Check if the max value exceeds 999 or the min value is less than -999
                                if (datmanMaxValue > 999) {
                                    console.log(`Data spike detected in location ${locationName}: max = ${datmanMaxValue}`);
                                    return true; // Return true if any spike is found
                                }
                                if (datmanMinValue < -999) {
                                    console.log(`Data spike detected in location ${locationName}: min = ${datmanMinValue}`);
                                    return true; // Return true if any spike is found
                                }
                            } else {
                                console.log(`No valid 'datman-max-value' or 'datman-min-value' found in location ${locationName}.`);
                            }
                        }
                    }
                }
        
                // Return false if no data spikes were found
                console.log('No data spikes detected in any location.');
                return false;
            }
        
            function createTable(data) {
                const table = document.createElement('table');
                table.id = 'customers'; // Assigning the ID of "customers"
        
                data.forEach(item => {
                    // Create header row for the item's ID
                    const headerRow = document.createElement('tr');
                    const idHeader = document.createElement('th');
                    idHeader.colSpan = 4;
                    // Apply styles
                    idHeader.style.backgroundColor = 'darkblue';
                    idHeader.style.color = 'white';
                    idHeader.textContent = item.id; // Display the item's ID
                    headerRow.appendChild(idHeader);
                    table.appendChild(headerRow);
        
                    // Create subheader row for "Time Series", "Value", "Date Time"
                    const subHeaderRow = document.createElement('tr');
                    ['Time Series', 'Value', 'Earliest Time', 'Latest Time'].forEach(headerText => {
                        const td = document.createElement('td');
                        td.textContent = headerText;
                        subHeaderRow.appendChild(td);
                    });
                    table.appendChild(subHeaderRow);
        
                    // Process each assigned location
                    item['assigned-locations'].forEach(location => {
                        const datmanData = location['extents-data']?.['datman'] || [];
        
                        // Function to create data row
                        const createDataRow = (tsid, value, timestamp, earliestTime) => {
                            const dataRow = document.createElement('tr');
        
                            const nameCell = document.createElement('td');
                            nameCell.textContent = tsid;
        
                            const lastValueCell = document.createElement('td');
        
                            // Create the span for the value
                            const valueSpan = document.createElement('span');
        
                            // Check if the value is null or not
                            if (value === null || isNaN(value)){
                                valueSpan.classList.add('blinking-text');
                                valueSpan.textContent = 'N/A'; // Or any placeholder you want for null values
                            } else {
                                valueSpan.textContent = parseFloat(value).toFixed(2);
                            }
        
                            lastValueCell.appendChild(valueSpan);
        
                            const earliestTimeCell = document.createElement('td');
                            earliestTimeCell.textContent = earliestTime;
        
                            const latestTimeCell = document.createElement('td');
                            latestTimeCell.textContent = timestamp;
        
                            dataRow.appendChild(nameCell);
                            dataRow.appendChild(lastValueCell);
                            dataRow.appendChild(earliestTimeCell);
                            dataRow.appendChild(latestTimeCell);
        
                            table.appendChild(dataRow);
                        };
        
                        // Process Datman data
                        datmanData.forEach(datmanEntry => {
                            const tsid = datmanEntry.name; // Time-series ID from extents-data
                            const earliestTime = datmanEntry.earliestTime;
                            const latestTime = datmanEntry.latestTime;
        
                            // Safely access 'do-last-value'
                            const lastDatmanValue = (Array.isArray(location['datman-last-value'])
                                ? location['datman-last-value'].find(entry => entry && entry.tsid === tsid)
                                : null) || { value: 'N/A', timestamp: 'N/A' };
        
                            let dateTimeDatman = null;
                            dateTimeDatman = datmanEntry.latestTime;
                            createDataRow(tsid, lastDatmanValue.value, dateTimeDatman, earliestTime);
                        });
        
                        // If no data available for temp-water, depth, and do
                        if (datmanData.length === 0) {
                            const dataRow = document.createElement('tr');
        
                            const nameCell = document.createElement('td');
                            nameCell.textContent = 'No Data Available';
                            nameCell.colSpan = 3; // Span across all three columns
        
                            dataRow.appendChild(nameCell);
                            table.appendChild(dataRow);
                        }
                    });
                });
        
                return table;
            }
        
            function createTableDataSpike(data) {
                const table = document.createElement('table');
                table.id = 'customers'; // Assigning the ID of "customers"
        
                data.forEach(item => {
                    const assignedLocations = item['assigned-locations'];
        
                    // Proceed only if there are assigned locations
                    if (Array.isArray(assignedLocations) && assignedLocations.length > 0) {
        
                        // Process each assigned location
                        assignedLocations.forEach(location => {
                            let hasDataRows = false; // Reset flag for each location
        
                            const datmanMaxData = location['datman-max-value'] || [];
                            const datmanMinData = location['datman-min-value'] || [];
                            const ownerData = location['owner'][`assigned-locations`] || [];
                            const locationIdData = location['location-id'] || [];
        
                            // console.log("ownerData: ", ownerData);
                            // console.log("locationIdData: ", locationIdData);
        
                            // Temporary storage for data entries to check for spikes
                            const spikeData = [];
        
                            // Check each data type for spikes, with both min and max values
                            const checkForSpikes = (minDataArray, maxDataArray) => {
                                minDataArray.forEach((minEntry, index) => {
                                    const tsid = minEntry.tsid;
                                    const minValue = parseFloat(minEntry.value); // Get min value
                                    const maxEntry = maxDataArray[index];
                                    const maxValue = parseFloat(maxEntry?.value || 0); // Get max value (ensure no undefined)
                                    const latestTime = minEntry.timestamp; // Use timestamp from minDataArray
        
                                    // Check for spike condition (both min and max)
                                    if (maxValue > 999 || minValue < -999) {
                                        spikeData.push({
                                            tsid,
                                            maxValue: maxValue.toFixed(2),
                                            minValue: minValue.toFixed(2),
                                            timestamp: latestTime
                                        });
                                        hasDataRows = true; // Mark that we have valid data rows
                                    }
                                });
                            };
        
                            // Check for spikes in each type of data
                            checkForSpikes(datmanMinData, datmanMaxData);
        
                            // Log the collected spike data for debugging
                            // console.log("datmanMaxData: ", datmanMaxData);
                            // console.log("datmanMinData: ", datmanMinData);
                            // console.log(`Spike data for location ${location[`location-id`]}:`, spikeData);
                            // console.log("hasDataRows: ", hasDataRows);
        
                            // Create header and subheader if we have spike data
                            if (hasDataRows) {
                                // Create header row for the item's ID
                                const headerRow = document.createElement('tr');
                                const idHeader = document.createElement('th');
                                idHeader.colSpan = 4; // Adjusting colspan for an additional column
                                idHeader.style.backgroundColor = 'darkblue';
                                idHeader.style.color = 'white';
                                idHeader.textContent = item.id; // Display the item's ID
                                headerRow.appendChild(idHeader);
                                table.appendChild(headerRow);
        
                                // Create subheader row for "Time Series", "Max Value", "Min Value", "Latest Time"
                                const subHeaderRow = document.createElement('tr');
                                ['Time Series', 'Max Value', 'Min Value', 'Latest Time'].forEach((headerText, index) => {
                                    const td = document.createElement('td');
                                    td.textContent = headerText;
        
                                    // Set width for each column
                                    if (index === 0) {
                                        td.style.width = '50%';
                                    } else if (index === 1 || index === 2) {
                                        td.style.width = '15%';
                                    } else {
                                        td.style.width = '20%';
                                    }
        
                                    subHeaderRow.appendChild(td);
                                });
                                table.appendChild(subHeaderRow);
        
                                // Append data rows for spikes
                                spikeData.forEach(({ tsid, maxValue, minValue, timestamp }) => {
                                    createDataRow(tsid, maxValue, minValue, timestamp, ownerData, locationIdData);
                                });
                            }
                        });
                    }
                });
        
        
                return table;
        
                // Helper function to create data rows
                function createDataRow(tsid, maxValue, minValue, timestamp, ownerData, locationIdData) {
                    const dataRow = document.createElement('tr');
        
                    // First column (tsid) as a link
                    const nameCell = document.createElement('td');
                    const link = document.createElement('a');
                    link.href = `https://wm.mvs.ds.usace.army.mil/district_templates/chart/index.html?office=MVS&cwms_ts_id=${tsid}&cda=${cda}&lookback=90`; // Set the link's destination (you can modify the URL)
                    link.target = '_blank'; // Open link in a new tab
                    link.textContent = tsid;
                    nameCell.appendChild(link);
        
                    // Check if locationIdData matches any entry in ownerData
                    const isMatch = ownerData.some(owner => owner['location-id'] === locationIdData);
                    if (!isMatch) {
                        nameCell.style.color = 'darkblue'; // Apply dark blue color if there's a match
                    }
        
                    const maxValueCell = document.createElement('td');
                    // Wrap the max value in a span with the blinking-text class
                    const maxValueSpan = document.createElement('span');
                    maxValueSpan.classList.add('blinking-text');
                    maxValueSpan.textContent = maxValue;
                    maxValueCell.appendChild(maxValueSpan);
        
                    const minValueCell = document.createElement('td');
                    // Wrap the min value in a span with the blinking-text class
                    const minValueSpan = document.createElement('span');
                    minValueSpan.classList.add('blinking-text');
                    minValueSpan.textContent = minValue;
                    minValueCell.appendChild(minValueSpan);
        
                    const latestTimeCell = document.createElement('td');
                    latestTimeCell.textContent = timestamp;
        
                    dataRow.appendChild(nameCell);
                    dataRow.appendChild(maxValueCell);
                    dataRow.appendChild(minValueCell);
                    dataRow.appendChild(latestTimeCell);
        
                    table.appendChild(dataRow);
                }
            }
        });

    } catch (error){
        console.error(error);
        errorMessageDiv.classList.add('show');
        loadingDiv.classList.remove('show');
    }

}



/*======================= Functions For Script =======================*/
function initialize(data) {

    fetchedData = data;

    instructionBtn.addEventListener('click', function(){
        instructionsDiv.classList.toggle('show');
    });

    dailyCheckbox.addEventListener('click', function() {
        if (!dailyCheckbox.checked) {
            dailyCheckbox.click();
        }

        metadataDiv.classList.remove('show');
        tableResultsDiv.classList.remove('show');
    });

    hourlyCheckbox.addEventListener('click', function() {
        if (!hourlyCheckbox.checked) {
            hourlyCheckbox.click();
        }

        metadataDiv.classList.remove('show');
        tableResultsDiv.classList.remove('show');
    });

    missingDateWindowCloseBtn.addEventListener('click', function() {
        if (!haveClass(missingDateWindow, 'hidden')){
            missingDateWindow.classList.add('hidden')
        }
    });

    // Excel initial function (Alert)
    getExcelBtn.addEventListener('click', excelNoDataMessage);

    // Json initial function (Alert)
    getJSONBtn.addEventListener('click', jsonNoDataMessage)

    // Add dark mode functionality
    darkModeCheckbox.addEventListener('click', toggleDarkModeBtn);

    // Add function to popup window button
    //popupWindowBtn.addEventListener('click', blurBackground);

    // Extract the names of the basins with the list of gages
    let namesObject = getNames(data);

    // Checkbox Functions
    dailyCheckbox.addEventListener('click', function() {
        if (hourlyCheckbox.checked) {
            hourlyCheckbox.checked = false;
            getExcelBtn.disabled = true;
            getJSONBtn.disabled = true;
            basinExcelBtn.disabled = true;
            basinJSONBtn.disabled = true;
            importantMessageDiv.classList.remove('show');
        }
        addGageNames(namesObject);

        if (basinName.value !== "Select Basin"){
            // Add option for whole basin
            let option = document.createElement('option');
            option.value = 'All Gages';
            option.text = "All Gages";

            gageName.insertBefore(option, gageName.firstChild);
        }

        // Add Select Gage Option
        let option_2 = document.createElement('option');
        option_2.value = 'Select Gage';
        option_2.text = "Select Gage";
        
        gageName.insertBefore(option_2, gageName.firstChild);

        gageName.selectedIndex = 0;

        gageName.value = previousGage;
    });

    hourlyCheckbox.addEventListener('click', function() {
        if (dailyCheckbox.checked) {
            dailyCheckbox.checked = false;
            getExcelBtn.disabled = true;
            getJSONBtn.disabled = true;
            basinExcelBtn.disabled = true;
            basinJSONBtn.disabled = true;
            importantMessageDiv.classList.remove('show');
        }
        addGageNames(namesObject);

        if (basinName.value !== "Select Basin"){
            // Add option for whole basin
            let option = document.createElement('option');
            option.value = 'All Gages';
            option.text = "All Gages";

            gageName.insertBefore(option, gageName.firstChild);
        }

        // Add Select Gage Option
        let option_2 = document.createElement('option');
        option_2.value = 'Select Gage';
        option_2.text = "Select Gage";

        gageName.insertBefore(option_2, gageName.firstChild);

        gageName.selectedIndex = 0;

        gageName.value = previousGage;

    });

    // Add the basins names to the basin combobox
    addBasinNames(basinName, namesObject);

    // Add data to the gage combobox at the beggining of the code
    //addGageNames(namesObject);

    // Add option for whole basin
    // let option = document.createElement('option');
    // option.value = 'All Gages';
    // option.text = "All Gages";

    // Add Select Gage Option
    let option_2 = document.createElement('option');
    option_2.value = 'Select Gage';
    option_2.text = "Select Gage";

    //gageName.insertBefore(option, gageName.firstChild);
    gageName.append(option_2);

    // Change the gage values each time the basin value is changed
    basinName.addEventListener('change', function() {

        if (!haveClass(missingDateWindow, 'hidden')){
            missingDateWindow.classList.add('hidden');
        }

        isProjectText.textContent = "";

        errorMessageDiv.classList.remove('show');
        errorMessageText.textContent = "Oops, something went wrong! Please try refreshing the page and attempting again. If the problem persists, feel free to contact Water Control for assistance. We apologize for the inconvenience!";

        haveGageData = false;
        haveBasinData = false;
        
        if (!basinExcelBtn.disabled){
            disableBasinFilesBtns();
        }

        if (!getExcelBtn.disabled){
            disableFilesBtns();
        }

        tableResultsDiv.classList.remove('show');
        metadataDiv.classList.remove('show');

        addGageNames(namesObject);
        updateAvailablePORTable(data);

        getJSONBtn.removeEventListener('click', exportTableToJSON);
        getJSONBtn.removeEventListener('click', jsonNoDataMessage);
        getJSONBtn.addEventListener('click', jsonNoDataMessage);

        getExcelBtn.removeEventListener('click', exportTableToExcel);
        getExcelBtn.removeEventListener('click', excelNoDataMessage);
        getExcelBtn.addEventListener('click', excelNoDataMessage);

        getBasinDataBtn.removeEventListener('click', getAllBasinGages);
        getBasinDataBtn.addEventListener('click', getAllBasinGages);

        importantMessageDiv.classList.remove('show');

        isNGVD29(gageName.value);

        if (basinName.value !== "Select Basin"){
            // Add option for whole basin
            let option = document.createElement('option');
            option.value = 'All Gages';
            option.text = "All Gages";

            gageName.insertBefore(option, gageName.firstChild);
        }

        // Add Select Gage Option
        let option_2 = document.createElement('option');
        option_2.value = 'Select Gage';
        option_2.text = "Select Gage";

        gageName.insertBefore(option_2, gageName.firstChild);

        gageName.selectedIndex = 0;

        getDataBtn.disabled = true;
        getBasinDataBtn.disabled = true;

        if (gageName.value === "All Gages"){
            getDataBtn.disabled = true;
            getBasinDataBtn.disabled = false;

            PORBeginDate.textContent = "MM/DD/YYYY";
            POREndDate.textContent = "MM/DD/YYYY";

            isProjectText.textContent = "";
        } else {
            getDataBtn.disabled = false;
            getBasinDataBtn.disabled = true;
        }

        if (basinName.value === "Select Basin"){
            gageName.selectedIndex = 0;
            getDataBtn.disabled = true;
            getBasinDataBtn.disabled = true;

            PORBeginDate.textContent = "MM/DD/YYYY";
            POREndDate.textContent = "MM/DD/YYYY";

            isProjectText.textContent = "";
        }

        if (gageName.value === "Select Gage"){
            getDataBtn.disabled = true;
            getBasinDataBtn.disabled = true;

            PORBeginDate.textContent = "MM/DD/YYYY";
            POREndDate.textContent = "MM/DD/YYYY";

            isProjectText.textContent = "";
        }

    });

    // Add option for whole basin
    let selectBasinOption = document.createElement('option');
    selectBasinOption.value = 'Select Basin';
    selectBasinOption.text = "Select Basin";

    basinName.insertBefore(selectBasinOption, basinName.firstChild);

    basinName.selectedIndex = 0;

    getBasinDataBtn.disabled = true;

    // Update 'Avaliable POR' table everytime the gage name is changed
    gageName.addEventListener('change', function(){

        if (!haveClass(missingDateWindow, 'hidden')){
            missingDateWindow.classList.add('hidden');
        }

        errorMessageDiv.classList.remove('show');
        errorMessageText.textContent = "Oops, something went wrong! Please try refreshing the page and attempting again. If the problem persists, feel free to contact Water Control for assistance. We apologize for the inconvenience!";

        haveGageData = false;

        if (!getExcelBtn.disabled){
            disableFilesBtns();
        }

        tableResultsDiv.classList.remove('show');
        metadataDiv.classList.remove('show');

        updateAvailablePORTable(data);

        getJSONBtn.removeEventListener('click', exportTableToJSON);
        getJSONBtn.removeEventListener('click', jsonNoDataMessage);
        getJSONBtn.addEventListener('click', jsonNoDataMessage);

        getExcelBtn.removeEventListener('click', exportTableToExcel);
        getExcelBtn.removeEventListener('click', excelNoDataMessage);
        getExcelBtn.addEventListener('click', excelNoDataMessage);

        isNGVD29(gageName.value);

        previousGage = gageName.value;

        if (gageName.value === "All Gages"){
            getDataBtn.disabled = true;
            getBasinDataBtn.disabled = false;

            PORBeginDate.textContent = "MM/DD/YYYY";
            POREndDate.textContent = "MM/DD/YYYY";

            isProjectText.textContent = "";

        } else {
            getDataBtn.disabled = false;
            getBasinDataBtn.disabled = true;
        }

        if (gageName.value === "Select Gage"){
            getDataBtn.disabled = true;

            PORBeginDate.textContent = "MM/DD/YYYY";
            POREndDate.textContent = "MM/DD/YYYY";

            isProjectText.textContent = "";
        }

        getExcelBtn.disabled = true;
        getJSONBtn.disabled = true;

    });

    isNGVD29(gageName.value);

    updateAvailablePORTable(data);

    isProjectText.textContent = "";

    PORBeginDate.textContent = "MM/DD/YYYY";
    POREndDate.textContent = "MM/DD/YYYY";

    previousGage = gageName.value;

    dailyCheckbox.addEventListener('change', function() {
        updateAvailablePORTable(data);
    });

    hourlyCheckbox.addEventListener('change', function() {
        updateAvailablePORTable(data);
    });

    basinName.addEventListener('change', function() {
        updateAvailablePORTable(data);
    });

    console.log("Data: ", data);

    getDataBtn.addEventListener('click', async function() {

        if (!haveClass(missingDateWindow, 'hidden')){
            missingDateWindow.classList.add('hidden');
        }

        errorMessageDiv.classList.remove('show');
        errorMessageText.textContent = "Oops, something went wrong! Please try refreshing the page and attempting again. If the problem persists, feel free to contact Water Control for assistance. We apologize for the inconvenience!";

        instructionsDiv.classList.remove('show');

        importantMessageDiv.classList.remove('show');

        disableButtons();

        if (haveBasinData){
            disableBasinFilesBtns();
        }

        tableResultsDiv.classList.remove('show');
        //loadingDiv.classList.add('show');

        progressBar.style.width = '0%';

        if (haveClass(progressBarDiv, 'hidden')){
            progressBarDiv.classList.remove('hidden');
        }

        let counter = 0;
        let totalCounters = 20;
        let sleepTime = 250;

        processNextItem(counter, totalCounters, "Getting Gage Data");
        await sleep(sleepTime);

        // Excel initial function (Alert)
        getExcelBtn.removeEventListener('click', excelNoDataMessage);
    
        // Json initial function (Alert)
        getJSONBtn.removeEventListener('click', jsonNoDataMessage)
    
        // Hide result div before getting the data if the result div is showing
        //resultsDiv.classList.add('hidden');
    
        // Show loading animation
        //showLoading();

        let datmanName;
        let stageName;
        let urlName;

        data.forEach(element => {
            if (element['id'] === basinName.value) {
                element['assigned-locations'].forEach(item => {
                    if (item['location-id'] === gageName.value) {
                        datmanName = item['extents-data']['datman'][0]['name'];
                        stageName = item['tsid-stage']['assigned-time-series'][0]['timeseries-id'];
                    }
                });
            };
            
        });

        counter += 1;
        processNextItem(counter, totalCounters, "Getting Gage Data");
        await sleep(sleepTime);

        if (hourlyCheckbox.checked) {

            urlName = stageName;

            let offsetYear = 5;
            let endDateInput = new Date(endDate.value.split('-')[0], endDate.value.split('-')[1] - 1, endDate.value.split('-')[2]);

            let newYear = parseInt(beginDate.value.split('-')[0]);
            let compareDate = new Date(`${newYear + offsetYear}`, beginDate.value.split('-')[1] - 1, beginDate.value.split('-')[2]);
            console.log("Compare Date: ", compareDate);

            if (compareDate < endDateInput){
                errorMessageDiv.classList.add('show');
                errorMessageText.textContent = `For hourly data, the time window cannot be greater than ${offsetYear} years`;

                loadingDiv.classList.remove('show');

                disableButtons();
                getDataBtn.disabled = false;
                if (haveBasinData){
                    disableBasinFilesBtns();
                }

                throw new Error("Data time window is greater than" + offsetYear);
            }

        } else {
            urlName = datmanName;
        };

        counter += 1;
        processNextItem(counter, totalCounters, "Getting Gage Data");
        await sleep(sleepTime);

        // Handle Daylight Saving
        let newBeginDate = new Date(beginDate.value.split('-')[0], beginDate.value.split('-')[1] - 1, beginDate.value.split('-')[2]);
        let currentEndDate = new Date(endDate.value.split('-')[0], endDate.value.split('-')[1] - 1, endDate.value.split('-')[2]);
        let julyDate = new Date(beginDate.value.split('-')[0], 6, 1);
        let offsetBegin = newBeginDate.getTimezoneOffset();
        let offsetJuly = julyDate.getTimezoneOffset();

        counter += 1;
        processNextItem(counter, totalCounters, "Getting Gage Data");
        await sleep(sleepTime);

        let beginHours = "T05%3A00%3A00.00Z&end=";

        let nextDay = new Date(currentEndDate);
        nextDay.setDate(nextDay.getDate() + 1);

        let endHours = "T04%3A30%3A00.00Z";
        let newEndDateDay = nextDay.getDate() > 9 ? `${nextDay.getDate()}` : `0${nextDay.getDate()}`;
        let newEndDateMonth = (nextDay.getMonth() + 1) > 9 ? `${nextDay.getMonth() + 1}` : `0${nextDay.getMonth() + 1}`;
        let newEndDate = `${nextDay.getFullYear()}-${newEndDateMonth}-${newEndDateDay}`;

        counter += 1;
        processNextItem(counter, totalCounters, "Getting Gage Data");
        await sleep(sleepTime);

        if (offsetBegin != offsetJuly){
            beginHours = "T06%3A00%3A00.00Z&end=";
            endHours = "T05%3A30%3A00.00Z";
        }

        counter += 1;
        processNextItem(counter, totalCounters, "Getting Gage Data");
        await sleep(sleepTime);

        // Get data for the period of record
        let dataAmount = 1000000;
        pageURL = domain + "/timeseries?" + "name=" + urlName + "&office=MVS&begin=" + beginDate.value + beginHours + newEndDate + endHours + "&page-size=" + dataAmount;
        console.log("TimeSerieURL: ", pageURL);

        counter += 1;
        processNextItem(counter, totalCounters, "Getting Gage Data");
        await sleep(sleepTime);

        fetchJsonFile(pageURL, async function(fetchedData){

            let dataValues = fetchedData['values']

            counter += 1;
            processNextItem(counter, totalCounters, "Getting Gage Data")

            let formattedData = [];

            dataValues.forEach(element => {
                formattedData.push({
                    date: reformatDate(element[0]),
                    value: element[1],
                    qualityCode: element[2],
                });
            });

            counter += 1;
            processNextItem(counter, totalCounters, "Getting Gage Data");
            await sleep(sleepTime);

            globalData = [];
            
            formattedData.forEach(element => {
                globalData.push(element);
            });

            counter += 1;
            processNextItem(counter, totalCounters, "Getting Gage Data");
            await sleep(sleepTime);

            console.log("Formatted Data: ", formattedData);

            if (dailyCheckbox.checked){
                formattedData.forEach(element => {
                    element.date += " 08:00";
                });
            };

            // Find Missing Dates
            let datesList = [];
            formattedData.forEach(element => {
                let date = `${element['date'].split(' ')[0]}`;
                let month = date.split('-')[0];
                let day = date.split('-')[1];
                let year = date.split('-')[2];
                datesList.push(`${month}-${day}-${year}`);
            });

            counter += 1;
            processNextItem(counter, totalCounters, "Getting Gage Data");
            await sleep(sleepTime);

            let missingDatesList = findMissingDates(datesList);

            let actualMissingDates = [];

            missingDatesList.forEach(date => {
                let missingReformattedDate = `${date.split('-')[1]}-${date.split('-')[2]}-${date.split('-')[0]}`;
                if (!datesList.includes(missingReformattedDate)){
                    actualMissingDates.push(missingReformattedDate);
                }
            })

            counter += 1;
            processNextItem(counter, totalCounters, "Getting Gage Data");
            await sleep(sleepTime);

            console.log("Missing Dates: ", actualMissingDates);

            // insertMissingDates(formattedData, actualMissingDates);

            metadataTitle.textContent = gageName.value;

            metadataDescription.innerHTML = `Description:<br>${gageMetadata.description}`;

            counter += 1;
            processNextItem(counter, totalCounters, "Getting Gage Data");
            await sleep(sleepTime);

            if (isProjectText.textContent !== "Datum: NGVD29"){
                metadataDatum88.innerHTML = `${gageMetadata.elevation.toFixed(2)}ft NAVD 88, add datum to stage to obtain elevation`;
            } else {
                const levelIdEffectiveDate = "2024-01-01T08:00:00"; 
                const officeName = "mvs";
                const cda = "internal";

                let setBaseUrl = cda === "internal"
                        ? `https://wm.${officeName.toLowerCase()}.ds.usace.army.mil:8243/${officeName.toLowerCase()}-data/`
                        : `https://cwms-data.usace.army.mil/cwms-data/`;

                const levelIdNgvd29 = `${gageName.value}.Height.Inst.0.NGVD29`;
                const ngvd29ApiUrl = `${setBaseUrl}levels/${levelIdNgvd29}?office=${officeName.toLowerCase()}&effective-date=${levelIdEffectiveDate}&unit=ft`;

                console.log("NGVD29 URL: ", ngvd29ApiUrl);
                
                fetch(ngvd29ApiUrl)
                    .then(response => {
                        if (!response.ok){
                            throw new Error("Network was not ok. " + response.status);
                        }
                        return response.json();
                    })
                    .then(data => {
                        // Set map to null if the data is null or undefined
                        console.log("Project Data: ", data);
                        metadataDatum88.innerHTML = `${(gageMetadata.elevation - data['constant-value']).toFixed(2)} ft NAVD88, add datum to stage to obtain elevation.`;
                    })
                    .catch(error => {
                        console.error(`Error fetching ngvd29 level for ${gageName.value.split('.')[0]}:`, error);
                        errorMessageDiv.classList.add('show');
                        loadingDiv.classList.remove('show');
                    });
            }

            counter += 1;
            processNextItem(counter, totalCounters, "Getting Gage Data");
            await sleep(sleepTime);

            if (isProjectText.textContent === "Datum: NGVD29" && dailyCheckbox.checked){
                metadataRecordedTime.textContent = "All values were recorded at 08:00 am NGVD29 stage in ft";
            } else if (isProjectText.textContent !== "Datum: NGVD29" && dailyCheckbox.checked){
                metadataRecordedTime.textContent = "All values were recorded at 08:00 am NAVD88 stage in ft";
            } else {
                metadataRecordedTime.textContent = "";
            }

            counter += 1;
            processNextItem(counter, totalCounters, "Getting Gage Data");
            await sleep(sleepTime);

            let metadataBeginDate = `${PORBeginDate.textContent.split('/')[0]}-${PORBeginDate.textContent.split('/')[1]}-${PORBeginDate.textContent.split('/')[2]}`;
            let metadataEndDate = `${POREndDate.textContent.split('/')[0]}-${POREndDate.textContent.split('/')[1]}-${POREndDate.textContent.split('/')[2]}`;
            metadataPeriodOfRecord.textContent = `Period of Record: ${metadataBeginDate} to ${metadataEndDate}`;

            if (actualMissingDates.length > 0){
                let dssMessage = "If this data is going to be used to create a DSS file, please choose <strong>'IR-DAY'</strong> on the time interval."
                let missingExtraText = "  -> Click the number to see all the missing dates.";
                let style_1 = "font-size:0.8em; font-style:italic; font-weight:bold; color: var(--color-gray-for-text)"
                metadataMissingDates.innerHTML = `Missing Dates:  <a id="missing-number"><strong>${actualMissingDates.length}</strong></a> <span style="${style_1}">${missingExtraText}</span>` + "<br>" + dssMessage;
            } else {
                metadataMissingDates.innerHTML = "Missing Dates: NA";
            };

            counter += 1;
            processNextItem(counter, totalCounters, "Getting Gage Data");
            await sleep(sleepTime);

            if (hourlyCheckbox.checked){
                data.forEach(element => {
                    if (element['id'] === basinName.value){
                        element['assigned-locations'].forEach(gage => {
                            if (gage['location-id'] === gageName.value){
                                let datmanEndDate = gage['extents-data']['datman'][0]['lastUpdate'].split('T')[0].split('-');
                                let hourlyEndDate = gage['extents-data']['datman'][1]['lastUpdate'].split('T')[0].split('-');

                                let QAQCDate = `${datmanEndDate[1]}-${datmanEndDate[2]}-${datmanEndDate[0]}`;
                                metadataHighlightValues.innerHTML = `Data QA/QC Up Until: <strong>${QAQCDate}</strong>`;
                            }
                        });
                    }
                });
            } else {
                metadataHighlightValues.innerHTML = '';
            }

            counter += 1;
            processNextItem(counter, totalCounters, "Getting Gage Data");
            await sleep(sleepTime);

            tableTBody.innerHTML = '';

            globalFormattedData = [];

            formattedData.forEach(element => {
                globalFormattedData.push(element);
            });

            counter += 1;
            processNextItem(counter, totalCounters, "Getting Gage Data");
            await sleep(sleepTime);

            if (hourlyCheckbox.checked){
                let startPaintingDay = parseInt(metadataHighlightValues.innerHTML.toString().split('<strong>')[1].split('</strong>')[0].split('-')[1]);
                let startPaintingMonth = parseInt(metadataHighlightValues.innerHTML.toString().split('<strong>')[1].split('</strong>')[0].split('-')[0]);
                let startPaintingYear = parseInt(metadataHighlightValues.innerHTML.toString().split('<strong>')[1].split('</strong>')[0].split('-')[2]);

                let dateFormatted = new Date(startPaintingYear, startPaintingMonth - 1, startPaintingDay);
                dateFormatted.setDate(dateFormatted.getDate() + 1);

                let newMonth = String(dateFormatted.getMonth() + 1).padStart(2, "0");
                let newDay = String(dateFormatted.getDate()).padStart(2, "0");
                let newYear = dateFormatted.getFullYear();

                let startPaintingDate = `${newMonth}-${newDay}-${newYear} 00:00`;
                console.log("Paint Date: ", startPaintingDate);
                //Get row to start painting
                globalFormattedData.forEach((element, index) => {
                    if (element.date === startPaintingDate){
                        paintRow = index;
                    }
                })
            }

            counter += 1;
            processNextItem(counter, totalCounters, "Getting Gage Data");
            await sleep(sleepTime);
            

            // 500 Rows Max
            createFirstRows(tableTBody, globalFormattedData);

            //console.log('Table Rows: ', dataTable.children[1].children.length);

            // Remove event listener for the scroll event
            window.removeEventListener('scroll', scrollFunction);

            // Add event listener for the scroll event
            window.addEventListener('scroll', scrollFunction);

            //console.log("Formatted Data: ", formattedData);

            tableResultsDiv.classList.add('show');
            metadataDiv.classList.add('show');

            getExcelBtn.removeEventListener('click', exportTableToExcel);
            getExcelBtn.addEventListener('click', exportTableToExcel);

            getJSONBtn.removeEventListener('click', exportTableToJSON);
            getJSONBtn.addEventListener('click', exportTableToJSON);

            disableButtons();
            disableFilesBtns();

            getDataBtn.disabled = false;
            
            haveGageData = true;

            counter += 1;
            processNextItem(counter, totalCounters, "Getting Gage Data");
            await sleep(sleepTime);

            if (haveBasinData){
                disableBasinFilesBtns();
            }

            if (haveGageData && getDataBtn.disabled){
                getDataBtn.disabled = false;
            }

            if (haveGageData && getExcelBtn.disabled){
                disableFilesBtns();
            }
        
            //loadingDiv.classList.remove('show');

            tableResultsDiv.classList.add('show');
            //loadingDiv.classList.remove('show');

            // Create tooltip for missing values
            let word = document.getElementById("missing-number");

            // Create tooltip element
            if (word !== null){
                word.addEventListener('click', function() {
                    if (haveClass(missingDateWindow, 'hidden')){
                        missingDateWindow.classList.remove('hidden')
                    }
                });
            }

            if (actualMissingDates.length > 0){
                missingDateTableBody.innerHTML = "";
                actualMissingDates.forEach(element => {
                    let newRow = document.createElement('tr');
                    newRow.innerHTML = `<td>${element}</td>`

                    missingDateTableBody.append(newRow)
                })
            }

            counter += 1;
            processNextItem(counter, totalCounters, "Getting Gage Data");

            if (!haveClass(progressBarDiv, 'hidden')){
                progressBarDiv.classList.add('hidden');
            }

        }, function(){
            errorMessageDiv.classList.add('show');
            loadingDiv.classList.remove('show');
        });    
    
    });

    getBasinDataBtn.addEventListener('click', getAllBasinGages);

}

// Check is an element have a specific class
function haveClass(element, classString) {
    let result = false;
    element.classList.forEach(item => {
        if (item === classString){
            result = true;
        }
    });
    return result
}

function scrollFunction(){
    const rect = dataTable.getBoundingClientRect();
    const bottomViewport = rect.bottom;  // The bottom position relative to the viewport

    if (bottomViewport < 5000){
        appendToTable(dataTable.children[1], globalFormattedData);
    } else if(bottomViewport > 5000) {
        deleteFromTable(dataTable.children[1]);
    }
}

function disableButtons() {

    let elementList = [basinName, gageName, beginDate, endDate, getDataBtn, dailyCheckbox, hourlyCheckbox, darkModeCheckbox];
    elementList.forEach(element => {
        if (!element.disabled) {
            element.disabled = true;
        } else {
            element.disabled = false;
        }
    });

    if (refreshPage){
        getDataBtn.disabled = true;
    }

}

function disableFilesBtns(){
    let elementList = [getExcelBtn, getJSONBtn];
    elementList.forEach(element => {
        if (!element.disabled) {
            element.disabled = true;
        } else {
            element.disabled = false;
        }
    });
}

function disableBasinFilesBtns(){
    let elementList = [basinExcelBtn, basinJSONBtn];
    elementList.forEach(element => {
        if (!element.disabled) {
            element.disabled = true;
        } else {
            element.disabled = false;
        }
    });
}

function reformatDate(dateNumber) {
    let newDate = new Date(dateNumber);

    // Get day, month and year and ensure the days and months are 2 digits
    let month = newDate.getMonth() + 1 > 9 ? newDate.getMonth() + 1: `0${newDate.getMonth() + 1}`;
    let day = newDate.getDate() > 9 ? newDate.getDate(): `0${newDate.getDate()}`;
    let year = newDate.getFullYear();

    // Get hours and minutes and ensure they're 2 digits
    let hours = newDate.getHours() > 9 ? newDate.getHours() : `0${newDate.getHours()}`;
    let minutes = newDate.getMinutes() > 9 ? newDate.getMinutes() : `0${newDate.getMinutes()}`;

    if (dailyCheckbox.checked) {
        return `${month}-${day}-${year}`;
    } else {
        return `${month}-${day}-${year} ${hours}:${minutes}`;
    }
}

function reformatDateV02(dateNumber) {
    let newDate = new Date(dateNumber);

    let newBeginDate = new Date(beginDate.value.split('-')[0], beginDate.value.split('-')[1] - 1, beginDate.value.split('-')[2]);
    let julyDate = new Date(beginDate.value.split('-')[0], 6, 1);
    let offsetBegin = newBeginDate.getTimezoneOffset();
    let offsetJuly = julyDate.getTimezoneOffset();

    let offset;

    if (offsetBegin != offsetJuly){
        offset = new Date().getTimezoneOffset() + 60;
    } else {
        offset = new Date().getTimezoneOffset();
    }

    let timezoneOffsetMs = offset * 60 * 1000;

    newDate.setTime(newDate.getTime() + timezoneOffsetMs);

    return newDate
}

function findMissingDates(dates) {
    // Convert strings to Date objects using parseLocalDate and sort them
    const dateObjects = dates.map(date => new Date(date)).sort((a, b) => a - b);
    // console.log("Date Objects", dateObjects);

    const missingDates = [];
    for (let i = 0; i < dateObjects.length - 1; i++) {
        let currentDate = dateObjects[i];
        let nextDate = dateObjects[i + 1];

        // Add missing dates between the current and next date
        while (currentDate.getTime() + 86400000 < nextDate.getTime()) { // 86400000ms = 1 day
            currentDate = new Date(currentDate.getTime() + 86400000);
            missingDates.push(currentDate.toISOString().split('T')[0]);
        }
    }
    return missingDates;
}

function createFirstRows(tableBody, tableData) {
    let paintStyle = "color:red; font-weight:bold;";

    if (tableData.length > 500) {
        // There is more than 500 values
        for(let i = 0; i < 500; i++){
            let newRow = document.createElement('tr');

            if (i >= paintRow){
                newRow.style = paintStyle;
            }

            let tableValue = tableData[i].value === null ? "--" : tableData[i].value.toFixed(2);

            newRow.innerHTML = `<td>${tableData[i].date}</td>
            <td>${tableValue}</td>
            <td>${tableData[i].qualityCode}</td>`;
            tableBody.append(newRow);
        }

    } else {
        // There is less than 500 values
        for(let i = 0; i < tableData.length; i++){
            let newRow = document.createElement('tr');

            if (i >= paintRow){
                newRow.style = paintStyle;
            }

            let tableValue = tableData[i].value === null ? "--" : tableData[i].value.toFixed(2);

            newRow.innerHTML = `<td>${tableData[i].date}</td>
            <td>${tableValue}</td>
            <td>${tableData[i].qualityCode}</td>`;
            tableBody.append(newRow);
        }

    }
}

function appendToTable(tableBody, tableData) {
    // Get the amount of data already on the table
    let currentRows = dataTable.children[1].children.length;
    let paintStyle = "color:red; font-weight:bold;";

    // Check if the remaining data is greater than 10
    if (currentRows < tableData.length){

        if (tableData.length - currentRows > 10){

            // If greater than 10 then add 10 more values
            for(let i = 0; i < 10; i++){
                let newRow = document.createElement('tr');

                if (currentRows >= paintRow){
                    newRow.style = paintStyle;
                }

                let tableValue = tableData[currentRows + i].value === null ? "--" : tableData[currentRows + i].value.toFixed(2);

                newRow.innerHTML = `<td>${tableData[currentRows + i].date}</td>
                <td>${tableValue}</td>
                <td>${tableData[currentRows + i].qualityCode}</td>`;
                tableBody.append(newRow);

            }
    
        } else {

            // Add one by one if the remining data is less than 10
            let newRow = document.createElement('tr');

            if (currentRows >= paintRow){
                newRow.style = paintStyle;
            }

            let tableValue = tableData[currentRows + i].value === null ? "--" : tableData[currentRows + i].value.toFixed(2);

            newRow.innerHTML = `<td>${tableData[currentRows].date}</td>
            <td>${tableValue}</td>
            <td>${tableData[currentRows].qualityCode}</td>`;
            tableBody.append(newRow);
        }

    } else {
        console.log("Reached the end of the data.");
    }
}

function deleteFromTable(tableBody){
    let currentRows = dataTable.children[1].children.length;

    if (currentRows > 500){
        for(let i = 0; i < 10; i++){
            tableBody.deleteRow(currentRows - (i + 1));
        }
    }
    
}

// Update Available POR Function
function updateAvailablePORTable(input_data) {

    console.log("Input Data: ", input_data);

    if (gageName.value === "All Gages" && dailyCheckbox.checked){

        beginDate.value = "1800-01-01";

        let currentDate = new Date();
        let currentMonth = (currentDate.getMonth() + 1) > 9 ? currentDate.getMonth() + 1: `0${currentDate.getMonth() + 1}`;
        let currentDay = currentDate.getDate() > 9 ? currentDate.getDate() : `0${currentDate.getDate()}`;
        let currentYear = currentDate.getFullYear();
        endDate.value = `${currentYear}-${currentMonth}-${currentDay}`;

    } else if(gageName.value === "All Gages" && hourlyCheckbox.checked) {

        let currentDate = new Date();
        let currentMonth = (currentDate.getMonth() + 1) > 9 ? currentDate.getMonth() + 1: `0${currentDate.getMonth() + 1}`;
        let currentDay = currentDate.getDate() > 9 ? currentDate.getDate() : `0${currentDate.getDate()}`;
        let currentYear = currentDate.getFullYear();
        endDate.value = `${currentYear}-${currentMonth}-${currentDay}`;

        beginDate.value = `${currentYear - 1}-${currentMonth}-${currentDay}`;

    } else {

        input_data.forEach(element => {
            if (element['id'] === basinName.value) {
                element['assigned-locations'].forEach(item => {
                    if (item['location-id'] === gageName.value) {
                        console.log("Item: ", item)
                        let earliestDate = dailyCheckbox.checked ? item['extents-data']['datman'][0]['earliestTime'] : item['extents-data']['datman'][1]['earliestTime'];
                        let latestDate = dailyCheckbox.checked ? item['extents-data']['datman'][0]['latestTime'] : item['extents-data']['datman'][1]['latestTime'];
                        let startPORDate = document.querySelector('#info-table .por-start');
                        let endPORDate = document.querySelector('#info-table .por-end');
                        let startDateList = earliestDate.split('T')[0].split('-');
                        let endDateList = latestDate.split('T')[0].split('-');
                        let newInputBeginYear = startDateList[0];
                        let newInputBeginMonth = startDateList[1];
                        let newInputBeginDay = startDateList[2];
                        let newInputEndYear = endDateList[0];
                        let newInputEndMonth = endDateList[1];
                        let newInputEndDay = endDateList[2];
    
                        startPORDate.innerText = `${newInputBeginMonth}/${newInputBeginDay}/${newInputBeginYear}`;
                        endPORDate.innerHTML = `${newInputEndMonth}/${newInputEndDay}/${newInputEndYear}`;
                        gageMetadata = item.metadata;
    
                        beginDate.value = `${newInputBeginYear}-${newInputBeginMonth}-${newInputBeginDay}`; // YYYY-MMM-DD
                        endDate.value = `${newInputEndYear}-${newInputEndMonth}-${newInputEndDay}`; // YYYY-MMM-DD

                        if (hourlyCheckbox.checked){

                            beginDate.value = `${parseInt(newInputEndYear) - 1}-${newInputEndMonth}-${newInputEndDay}`; // YYYY-MMM-DD

                        }

                    }
                });
            };
        });
    
        if (gageMetadata['vertical-datum'] !== "NAVD88"){
            document.getElementById("is-project").textContent = "Datum: NGVD29";
        };

    }
}

function isNGVD29(inputGageName){
    let projectData = fetchedData[0]['assigned-locations'][0]['project']['assigned-locations']
    let isProject = false;

    projectData.forEach(element => {
        if(element['location-id'] === inputGageName){
            isProject = true;
        }
    });

    if(isProject){
        isProjectText.textContent = "Datum: NGVD29";
        tableStageTitleText.textContent = "Stage NGVD29[ft]"
    } else {
        isProjectText.textContent = "Datum: NAVD88";
        tableStageTitleText.textContent = "Stage[ft]"
    }
}

// Function to add gages names in combobox
function addGageNames(data) {
    gageName.options.length = 0;
    data.forEach(element => {
        if (element['basin'] === basinName.value) {

            if (dailyCheckbox.checked) {
                element['datman'].forEach(item => {
                    let option = document.createElement('option');
                    option.value = item;
                    option.textContent = item.split('.')[0];
                    gageName.appendChild(option);
                });
            } else if (hourlyCheckbox.checked) {
                // element['rev'].forEach(item => {  <=  Original Line
                element['datman'].forEach(item => {//<=  Temp Line
                    let option = document.createElement('option');
                    option.value = item;
                    option.textContent = item.split('.')[0];
                    gageName.appendChild(option);
                });
            }
            
        }
    });
}

function toggleDarkModeBtn() {
    userData.darkMode = darkModeCheckbox.checked;
    saveUserData(userData);
    applyDarkMode();
}

function applyDarkMode() {
    if (userData.darkMode == true) {
        document.getElementById('content-body').classList.add('dark');
        document.getElementById('page-container').classList.add('dark');
    } else {
        document.getElementById('content-body').classList.remove('dark');
        document.getElementById('page-container').classList.remove('dark');
    }
}

function excelNoDataMessage() {
    popupMessage('error', 'There is no data to create the excel file. Get the data first and try again.');
    popupWindowBtn.click();
}

function jsonNoDataMessage() {
    popupMessage('error', 'There is no data to create the json file. Get the data first and try again.');
    popupWindowBtn.click();
}

function exportTableToExcel() {
    exportTableToExcelV2();
}

async function exportTableToExcelV2() {

    let filename = gageName.value;

    if (dailyCheckbox.checked){
        filename += "-Daily";
    } else {
        filename += "-Hourly";
    }

    let emailBeginDate = `${beginDate.value.split('-')[1]}-${beginDate.value.split('-')[2]}-${beginDate.value.split('-')[0]}`;
    let emailEndDate = `${endDate.value.split('-')[1]}-${endDate.value.split('-')[2]}-${endDate.value.split('-')[0]}`;

    filename += `_${emailBeginDate}_to_${emailEndDate}`;

    if (dailyCheckbox.checked){
        globalData.forEach(element => {
            if(element.date.split(' ').length < 2){
                if (dailyCheckbox.checked){
                    globalData.forEach(element => {
                        element.date += " 8:00"
                    });
                };
            }
        });
    };

    let excelDisclamer = "NOTICE: All data contained herein is preliminary in nature and therefore subject to change. The data is for general information purposes ONLY and SHALL NOT be used in technical applications such as, but not limited to, studies or designs. All critical data should be obtained from and verified by the United States Army Corpsof Engineers. The United States Government assumes no liability for the completeness or accuracy of the data contained herein and any use of such data inconsistent with this disclaimer shall be solely at the risk of the user.";

    // Create a new workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`${gageName.value}`);

    // Add info
    const infoRows = [
        [`${gageName.value}`],
        [new Date().toString().split(' GMT')[0]],
        [`${excelDisclamer}`],
        ["Datum:"],
        [`${metadataDatum88.textContent}`]
    ];

    if (metadataRecordedTime.textContent !== "") {
        infoRows.push([`${metadataRecordedTime.textContent}`]);
    }

    infoRows.push([`${metadataPeriodOfRecord.textContent}`]);

    if (metadataMissingDates.textContent !== "Missing Dates: NA"){
        let missingDateText = metadataMissingDates.innerHTML.toString()
        let missingDateNumber = missingDateText.split('<strong>')[1].split('</strong>')[0];
        let missingDateMessage = missingDateText.split('<br>')[1].split('<strong>').join('').split('</strong>').join('');

        infoRows.push([`Missing Dates: ${missingDateNumber}`]);
        infoRows.push([`${missingDateMessage}`]);
    } else {
        infoRows.push(["Missing Dates: NA"]);
    };

    if (hourlyCheckbox.checked){
        let dataQAQCText = metadataHighlightValues.innerHTML.toString().split('<strong>').join('').split('</strong>').join('');

        infoRows.push([`${dataQAQCText}`]);
    }

    infoRows.push(["If you need additional data, please email dll-cemvs-water-managers@usace.army.mil"]);
    infoRows.push(["Date & Time (CST)", isProjectText.textContent === "Datum: NGVD29" ? "Stage NGVD29[ft]" : "Stage[ft]", "Quality Code"]);

    infoRows.forEach((row, rowIndex) => {
        worksheet.addRow(row);

        // Apply formatting (merging for the first three columns)
        if (rowIndex < infoRows.length - 1) {
            worksheet.mergeCells(`A${rowIndex + 1}:C${rowIndex + 1}`);
        }
    });

    worksheet.columns = [
        { width: 30 },
        { width: 30 },
        { width: 30 }
    ];

    // Add the table data below the info rows
    globalData.forEach(dataRow => {
        worksheet.addRow([dataRow.date, dataRow.value, dataRow.qualityCode])
    });

    worksheet.getRow(infoRows.length).font = {
        bold: true, 
        size: 14,
        color: {argb: "E0E1DD"}
    };

    worksheet.getRow(infoRows.length).alignment = {
        horizontal: "center", 
        vertical: "middle"
    };

    worksheet.getRow(infoRows.length).height = 25;

    worksheet.getCell(`A${infoRows.length}`).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {argb: "0D1B2A"}
    };

    worksheet.getCell(`B${infoRows.length}`).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {argb: "0D1B2A"}
    };

    worksheet.getCell(`C${infoRows.length}`).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {argb: "0D1B2A"}
    };

    worksheet.getCell("A1").font = {
        size: 20,
        bold: true
    };

    worksheet.getCell("A1").alignment = {
        horizontal: "right", 
        vertical: "middle"
    };

    worksheet.getCell("A2").font = {size: 14};

    worksheet.getCell("A2").alignment = {
        horizontal: "right", 
        vertical: "middle"
    };

    worksheet.getCell("A2").height = 30;

    worksheet.getCell("A3").alignment = {
        wrapText: true,
        vertical: "middle"
    };

    for (let i = 0; i < infoRows.length; i++){
        if (i === 2) {
            worksheet.getRow(i + 1).height = 110;
        } else if (i > 2) {
            worksheet.getRow(i + 1).height = 20;
            worksheet.getRow(i + 1).alignment = {vertical: "middle"};
        }
    }

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > infoRows.length - 1){
            row.alignment = {horizontal: "center"}
        }
    });

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > infoRows.length){
            row.getCell(2).numFmt = "0.00";
        }
    });

    // If it's hourly highlight text
    if (hourlyCheckbox.checked){
        let tempValue = worksheet.getCell(`A${infoRows.length - 2}`).value;
        let firstDate = `${tempValue.split(':')[1].trim()}`;
        let nextDay = `${addOneDayToDate(firstDate)} 00:00`;
        let firstPaintRow = null;

        worksheet.getCell(`A${infoRows.length - 2}`).value = {
            richText: [
                {text: `${tempValue.split(':')[0]}: `},
                {
                    text: `${tempValue.split(':')[1]}`,
                    font: {
                        bold: true,
                        color: { argb: 'FF0000 '},
                        size: 16
                    }
                }
            ]
        }

        worksheet.eachRow((row, rowNumber) => {
            let currentCell = String(row.getCell(1).value).trim();
            if (currentCell === nextDay){
                firstPaintRow = rowNumber;
            }
        });

        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber >= firstPaintRow && firstPaintRow !== null){
                row.getCell(1).font = { color: {argb: "FF0000"} };
                row.getCell(2).font = { color: {argb: "FF0000"} };
                row.getCell(3).font = { color: {argb: "FF0000"} };
            }
        });

    }

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `${filename}.xlsx`);
}

function exportTableToJSON() {

    let filename = gageName.value

    if (dailyCheckbox.checked){
        filename += "-Daily";
    } else {
        filename += "-Hourly";
    }

    // Mt Vernon-Big Muddy-Daily_01-01-2018_to_12-31-2020.json
    let emailBeginDate = `${beginDate.value.split('-')[1]}-${beginDate.value.split('-')[2]}-${beginDate.value.split('-')[0]}`;
    let emailEndDate = `${endDate.value.split('-')[1]}-${endDate.value.split('-')[2]}-${endDate.value.split('-')[0]}`;

    filename += `_${emailBeginDate}_to_${emailEndDate}`;

    if (dailyCheckbox.checked){
        globalData.forEach(element => {
            if(element.date.split(' ').length < 2){
                if (dailyCheckbox.checked){
                    globalData.forEach(element => {
                        element.date += " 8:00"
                    });
                };
            }
        });
    };

    let jsonMetadata = {
        name: gageName.value,
        datum: metadataDatum88.textContent,
        recordTime: metadataRecordedTime.textContent !== "" ? metadataRecordedTime.textContent : null,
        periodOfRecord: metadataPeriodOfRecord.textContent,
        missingDates: metadataMissingDates.innerHTML === "Missing Dates: NA" ? null : `${metadataMissingDates.innerHTML.toString().split('<br>')[0].split('<strong>')[1].split('</strong>')[0]}`,
        disclamer: disclamerText
    };

    let baginDateList = beginDate.value.split('-');
    let endDateList = endDate.value.split('-');

    let yearMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    let dssStartDate = `${baginDateList[2]}${yearMonths[parseInt(baginDateList[1]) - 1]}${baginDateList[0]}`;
    let dssEndDate = `${endDateList[2]}${yearMonths[parseInt(endDateList[1]) - 1]}${endDateList[0]}`;

    let dssPart_E = metadataMissingDates.innerHTML === "Missing Dates: NA" ? "1Day" : "IR-Day";

    if (hourlyCheckbox.checked) {
        dssPart_E = "30Minute";
    }

    let dssValues = {
        A: basinName.value,
        B: gageName.value,
        C: dailyCheckbox.checked ? "Stage - Observed at 08:00" : "Stage",
        D: `${dssStartDate}-${dssEndDate}`,
        E: dssPart_E,
        F: "OBS"
    };

    let jsonObject = {
        metadata: jsonMetadata,
        dss: dssValues,
        values: globalData
    }

    // Convert data to JSON
    let json = JSON.stringify(jsonObject, null, 2);

    // Create a blob from the JSON
    let blob = new Blob([json], { type: 'application/json' });

    // Create a link to download the JSON file
    let link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = `${filename}.json`;
    link.click();
}

async function getAllBasinGages(){

    errorMessageDiv.classList.remove('show');
    errorMessageText.textContent = "Oops, something went wrong! Please try refreshing the page and attempting again. If the problem persists, feel free to contact Water Control for assistance. We apologize for the inconvenience!";

    importantMessageDiv.classList.remove('show');

    instructionsDiv.classList.remove('show');

    disableButtons();
    //loadingDiv.classList.add('show');

    if (haveGageData){
        disableFilesBtns();
    };

    if (haveBasinData){
        disableBasinFilesBtns();
    };

    //loadingDiv.classList.add('show');

    let gagesList = [];

    globalGageList = [];

    getBasinDataBtn.disabled = true;

    fetchedData.forEach(element => {
        if (element['id'] === basinName.value) {

            console.log("Current Basin: ", element);

            let basinProjectList = element['assigned-locations'][0]['project']['assigned-locations'];

            element['assigned-locations'].forEach(item => {

                let gageIsProject = false;

                basinProjectList.forEach(tempGage => {
                    if (tempGage['location-id'] === item['location-id']){
                        gageIsProject = true;
                    }
                });

                gagesList.push({
                    name: item['location-id'],
                    datman: item['extents-data']['datman'][0]['name'],
                    stage: item['extents-data']['datman'][1]['name'],
                    dataType: dailyCheckbox.checked ? "daily" : "hourly",
                    metadata: item['metadata'],
                    periodOfRecord: {
                        datman: {
                            startDate: item['extents-data']['datman'][0]['earliestTime'].split('T')[0],
                            endDate: item['extents-data']['datman'][0]['latestTime'].split('T')[0]
                        },
                        stage: {
                            startDate: item['extents-data']['datman'][1]['earliestTime'].split('T')[0],
                            endDate: item['extents-data']['datman'][1]['latestTime'].split('T')[0]
                        }
                    },
                    isProject: gageIsProject,
                    navd88: 0
                });

            });
        };
    });

    // Handle Daylight Saving
    let newBeginDate = new Date(beginDate.value.split('-')[0], beginDate.value.split('-')[1] - 1, beginDate.value.split('-')[2]);
    let julyDate = new Date(beginDate.value.split('-')[0], 6, 1);
    let offsetBegin = newBeginDate.getTimezoneOffset();
    let offsetJuly = julyDate.getTimezoneOffset();

    let beginHours = "T05%3A00%3A00.00Z";
    let endHours = "T23%3A59%3A59.59Z";

    if (offsetBegin != offsetJuly){
        beginHours = "T06%3A00%3A00.00Z";
    }

    let haveError = false;

    gagesList.forEach(gage => {

        const levelIdEffectiveDate = "2024-01-01T08:00:00"; 
        const officeName = "mvs";
        const cda = "internal";

        let setBaseUrl = cda === "internal"
                ? `https://wm.${officeName.toLowerCase()}.ds.usace.army.mil:8243/${officeName.toLowerCase()}-data/`
                : `https://cwms-data.usace.army.mil/cwms-data/`;

        const levelIdNgvd29 = `${gage.name}.Height.Inst.0.NGVD29`;
        const ngvd29ApiUrl = `${setBaseUrl}levels/${levelIdNgvd29}?office=${officeName.toLowerCase()}&effective-date=${levelIdEffectiveDate}&unit=ft`;
        
        fetch(ngvd29ApiUrl)
            .then(response => {
                if (!response.ok){
                    throw new Error("Network was not ok. " + response.status);
                }
                return response.json();
            })
            .then(data => {
                // Set map to null if the data is null or undefined
                // console.log("Data: ", data);
                
                let conversion = (gage['metadata']['elevation'] - data['constant-value']).toFixed(2);

                if (gage['isProject']){
                    gage['navd88'] = parseFloat(conversion);
                }

                let urlName;

                if (hourlyCheckbox.checked) {
                    urlName = gage.stage;

                    let offsetYear = 2;
                    let endDateInput = new Date(endDate.value.split('-')[0], endDate.value.split('-')[1] - 1, endDate.value.split('-')[2]);

                    let newYear = parseInt(beginDate.value.split('-')[0]);
                    let compareDate = new Date(`${newYear + offsetYear}`, beginDate.value.split('-')[1] - 1, beginDate.value.split('-')[2]);

                    if (compareDate < endDateInput){
                        errorMessageDiv.classList.add('show');
                        errorMessageText.textContent = `For hourly data, the time window cannot be greater than ${offsetYear} years`;

                        loadingDiv.classList.remove('show');

                        haveError = true;
                        throw new Error("Data time window is greater than " + offsetYear + " years.");
                    }

                } else {
                    urlName = gage.datman;
                };


                // Get data for the period of record
                let dataAmount = 1000000;
                pageURL = domain + "/timeseries?" + "name=" + urlName + "&office=MVS&begin=" + beginDate.value + beginHours + "&end=" + endDate.value + endHours + "&page-size=" + dataAmount;
                //console.log("TimeSerieURL: ", pageURL);

                fetchJsonFile(pageURL, function(newGageData){

                    let gageValues = newGageData['values'];

                    let gageData = [];

                    gageValues.forEach(element => {
                        gageData.push({
                            date: reformatDate(element[0]),
                            value: element[1],
                            qualityCode: element[2]
                        });
                    });

                    if (dailyCheckbox.checked){
                        gageData.forEach(element => {
                            element['date'] += " 08:00";
                        });
                    };
                    gage.dataValues = gageData;

                }, function(){});


                
            })
            .catch(error => {
                console.error(`Error fetching ngvd29 level for ${gage.name}:`, error)
                throw error;
            });

    });


    console.log("Getting all gages data, please wait...");

    let dataReady = false;
    let countCheck = gagesList.length;

    progressBar.style.width = '0%';

    if (haveClass(progressBarDiv, 'hidden')){
        progressBarDiv.classList.remove('hidden');
    }

    while (!dataReady){

        let counter = 0;

        gagesList.forEach((element) => {

            if (element.dataValues) {
                counter += 1;
            }

        });

        processNextItem(counter, countCheck, "Loading Gages");

        if (counter === countCheck) {
            dataReady = true;
        } else {
            await sleep(500);
        }

    }

    if (!haveClass(progressBarDiv, 'hidden')){
        progressBarDiv.classList.add('hidden');
    }

    getBasinDataBtn.disabled = false;

    console.log("All gages data retrieved successfully.");
    

    if (!haveError) {

        console.log("Gage List: ", gagesList);

        if (haveGageData){
            disableFilesBtns();
        };

        disableButtons();

        disableBasinFilesBtns();

        //loadingDiv.classList.remove('show');

        haveBasinData = true;

        globalGageList = gagesList;

        basinExcelBtn.removeEventListener('click', createExcelSheet);
        basinExcelBtn.addEventListener('click', createExcelSheet);

        basinJSONBtn.removeEventListener('click', createJSONFile);
        basinJSONBtn.addEventListener('click', createJSONFile);

        importantMessageDiv.classList.add('show');
        importantMessageText.textContent = "Basin data has been successfully retrieved! Please click the 'Get Basin Excel' button to download the Excel file containing data for all gages in the selected basin.";

    } else {
        disableButtons();
        if (haveGageData){
            disableFilesBtns();
        };
    }
    
}

function processNextItem(currentItem, totalItems, text) {

    if (currentItem < totalItems) {
        // Simulate processing an item (replace with actual logic)
        console.log(`Processing item ${currentItem + 1} of ${totalItems}`);

        // Update progress
        let progressPercent = ((currentItem + 1) / totalItems) * 100;
        progressBar.style.width = `${progressPercent}%`;
        progressBar.textContent = `${Math.round(progressPercent)}%`;

        if (text === "Getting Gage Data"){
            progressBarText.innerHTML = `${text}...`;
        } else {
            progressBarText.innerHTML = `${text}... (${currentItem + 1}/${totalItems})`;
        }

    } else {
        console.log("Processing complete!");
    }
}

async function sleep(ms){
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function createExcelSheet(){

    //loadingDiv.classList.add('show');

    progressBar.style.width = '0%';

    if (haveClass(progressBarDiv, 'hidden')){
        progressBarDiv.classList.remove('hidden');
    }

    // Deactivate elements
    let elementList = [basinName, gageName, beginDate, endDate, getDataBtn, getBasinDataBtn, getExcelBtn, getJSONBtn, basinExcelBtn, basinJSONBtn, dailyCheckbox, hourlyCheckbox, darkModeCheckbox];
    let elementObjList = [];

    elementList.forEach(element => {
        elementObjList.push({
            element: element,
            active: element.disabled
        });

        if (!element.disabled){
            element.disabled = true;
        }

    });

    // Create a new workbook and worksheet
    const workbook = new ExcelJS.Workbook();

    let totalDataAmount = globalGageList.length;
    let counter = 0;
    globalGageList.forEach(currentGage => {

        if (!currentGage){
            return
        }

        const worksheet = workbook.addWorksheet(`${currentGage.name}`);

        // Add info
        const infoRows = [
            [`${currentGage.name}`],
            [new Date().toString().split(' GMT')[0]],
            [`${disclamerText}`],
            ["Datum:"]
        ];

        if (currentGage.isProject){
            infoRows.push([`${currentGage.navd88}ft NAVD 88, add datum to stage to obtain elevation.`]);
        } else {
            infoRows.push([`${currentGage.metadata.elevation.toFixed(2)}ft NAVD 88, add datum to stage to obtain elevation.`]);
        }

        if (currentGage.dataType === "daily"){
            if (currentGage.isProject) {
                infoRows.push(["All values were recorded at 08:00 am NGVD29 stage in ft."]);
            } else {
                infoRows.push(["All values were recorded at 08:00 am NAVD88 stage in ft."]);
            }
        }

        let periodOfRecordText = "Period of Record: ";
        if (currentGage.dataType === "daily") {
            let startDateList = currentGage.periodOfRecord.datman.startDate.split('-')
            let newStartDate = `${startDateList[1]}-${startDateList[2]}-${startDateList[0]}`
            let endDateList = currentGage.periodOfRecord.datman.endDate.split('-')
            let newEndDate = `${endDateList[1]}-${endDateList[2]}-${endDateList[0]}`
            periodOfRecordText += `${newStartDate} to ${newEndDate}`
        } else {
            let startDateList = currentGage.periodOfRecord.stage.startDate.split('-')
            let newStartDate = `${startDateList[1]}-${startDateList[2]}-${startDateList[0]}`
            let endDateList = currentGage.periodOfRecord.stage.endDate.split('-')
            let newEndDate = `${endDateList[1]}-${endDateList[2]}-${endDateList[0]}`
            periodOfRecordText += `${newStartDate} to ${newEndDate}`
        }

        infoRows.push([periodOfRecordText]);

        // Find Missing Dates
        let datesList = [];
        try{
            currentGage.dataValues.forEach(element => {
                let date = `${element['date'].split(' ')[0]}`;
                let month = date.split('-')[0];
                let day = date.split('-')[1];
                let year = date.split('-')[2];
                datesList.push(`${month}-${day}-${year}`);
            });
        } catch (error) {
            console.error('An error occurred:', error.message);
            console.log(`Error at gage '${currentGage.name}'`);
        }

        let missingDatesList = findMissingDates(datesList);

        let actualMissingDates = [];

        missingDatesList.forEach(date => {
            let missingReformattedDate = `${date.split('-')[1]}-${date.split('-')[2]}-${date.split('-')[0]}`;
            if (!datesList.includes(missingReformattedDate)){
                actualMissingDates.push(missingReformattedDate);
            }
        });

        if (actualMissingDates.length > 0){
            infoRows.push([`Missing Dates: ${actualMissingDates.length}`]);
            infoRows.push(["If this data is going to be used to create a DSS file, please choose 'IR-DAY' on the time interval."]);
        } else {
            infoRows.push(["Missing Dates: NA"]);
        }

        if (currentGage.dataType === "hourly"){
            let dateList = currentGage.periodOfRecord.datman.endDate.split('-')
            let newDate = `${dateList[1]}-${dateList[2]}-${dateList[0]}`
            let dataQAQCText = `Data QA/QC Up Until: ${newDate}`;
            infoRows.push([`${dataQAQCText}`]);
        }

        infoRows.push(["If you need additional data, please email dll-cemvs-water-managers@usace.army.mil"]);
        infoRows.push(["Date & Time (CST)", currentGage.isProject ? "Stage NGVD29[ft]" : "Stage[ft]", "Quality Code"]);

        infoRows.forEach((row, rowIndex) => {
            worksheet.addRow(row);

            // Apply formatting (merging for the first three columns)
            if (rowIndex < infoRows.length - 1) {
                worksheet.mergeCells(`A${rowIndex + 1}:C${rowIndex + 1}`);
            }
        });

        worksheet.columns = [
            { width: 30 },
            { width: 30 },
            { width: 30 }
        ];

        // Add the table data below the info rows
        currentGage.dataValues.forEach(dataRow => {
            worksheet.addRow([dataRow.date, dataRow.value, dataRow.qualityCode])
        });

        worksheet.getRow(infoRows.length).font = {
            bold: true, 
            size: 14,
            color: {argb: "E0E1DD"}
        };

        worksheet.getRow(infoRows.length).alignment = {
            horizontal: "center", 
            vertical: "middle"
        };

        worksheet.getRow(infoRows.length).height = 25;

        worksheet.getCell(`A${infoRows.length}`).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: {argb: "0D1B2A"}
        };

        worksheet.getCell(`B${infoRows.length}`).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: {argb: "0D1B2A"}
        };

        worksheet.getCell(`C${infoRows.length}`).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: {argb: "0D1B2A"}
        };

        worksheet.getCell("A1").font = {
            size: 20,
            bold: true
        };

        worksheet.getCell("A1").alignment = {
            horizontal: "right", 
            vertical: "middle"
        };

        worksheet.getCell("A2").font = {size: 14};

        worksheet.getCell("A2").alignment = {
            horizontal: "right", 
            vertical: "middle"
        };

        worksheet.getCell("A2").height = 30;

        worksheet.getCell("A3").alignment = {
            wrapText: true,
            vertical: "middle"
        };

        for (let i = 0; i < infoRows.length; i++){
            if (i === 2) {
                worksheet.getRow(i + 1).height = 110;
            } else if (i > 2) {
                worksheet.getRow(i + 1).height = 20;
                worksheet.getRow(i + 1).alignment = {vertical: "middle"};
            }
        }

        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber > infoRows.length - 1){
                row.alignment = {horizontal: "center"}
            }
        });

        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber > infoRows.length){
                row.getCell(2).numFmt = "0.00";
            }
        });

        // If it's hourly highlight text
        if (hourlyCheckbox.checked){
            let tempValue = worksheet.getCell(`A${infoRows.length - 2}`).value;
            let firstDate = `${tempValue.split(':')[1].trim()}`;
            let nextDay = `${addOneDayToDate(firstDate)} 00:00`
            let firstPaintRow = null;
    
            worksheet.getCell(`A${infoRows.length - 2}`).value = {
                richText: [
                    {text: `${tempValue.split(':')[0]}: `},
                    {
                        text: `${tempValue.split(':')[1]}`,
                        font: {
                            bold: true,
                            color: { argb: 'FF0000 '},
                            size: 16
                        }
                    }
                ]
            }

            worksheet.eachRow((row, rowNumber) => {
                let currentCell = String(row.getCell(1).value).trim();
                if (currentCell === nextDay){
                    firstPaintRow = rowNumber;
                }
            });

            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber >= firstPaintRow && firstPaintRow !== null){
                    row.getCell(1).font = { color: {argb: "FF0000"} };
                    row.getCell(2).font = { color: {argb: "FF0000"} };
                    row.getCell(3).font = { color: {argb: "FF0000"} };
                }
            });

        }

        counter += 1;

        processNextItem(counter, totalDataAmount, "Sheet completed");
    
    });

    let outputFileName = `${basinName.value}`;
    outputFileName += dailyCheckbox.checked ? "-Daily" : "-Hourly";

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `${outputFileName}.xlsx`);
    console.log("Basin Excel Files Saved.");

    elementObjList.forEach(element => {
        element.element.disabled = element.active;
    });

    if (!haveClass(progressBarDiv, 'hidden')){
        progressBarDiv.classList.add('hidden');
    }

    //loadingDiv.classList.remove('show');

}

function createJSONFile(){

    //loadingDiv.classList.add('show');

    progressBar.style.width = '0%';

    if (haveClass(progressBarDiv, 'hidden')){
        progressBarDiv.classList.remove('hidden');
    }

    // Deactivate elements
    let elementList = [basinName, gageName, beginDate, endDate, getDataBtn, getBasinDataBtn, getExcelBtn, getJSONBtn, basinExcelBtn, basinJSONBtn, dailyCheckbox, hourlyCheckbox, darkModeCheckbox];
    let elementObjList = [];

    elementList.forEach(element => {
        elementObjList.push({
            element: element,
            active: element.disabled
        });

        if (!element.disabled){
            element.disabled = true;
        }

    });

    console.log("All Gages List: ", globalGageList);

    let jsonObject = [];

    let totalDataAmount = globalGageList.length;
    let counter = 0;
    globalGageList.forEach(currentGage => {

        let datumText = " ft NAVD88, add datum to stage to obtain elevation.";
        let recordTimeText = null;

        if (currentGage.dataType === "daily" && currentGage.isProject){
            recordTimeText = "All values were recorded at 08:00 am NGVD29 stage in ft.";
        } else if (currentGage.dataType === "daily" && !currentGage.isProject){
            recordTimeText = "All values were recorded at 08:00 am NAVD88 stage in ft.";
        }

        let currentStartDate = currentGage.dataType === "daily" ? currentGage.periodOfRecord.datman.startDate : currentGage.periodOfRecord.stage.startDate;
        let currentEndDate = currentGage.dataType === "daily" ? currentGage.periodOfRecord.datman.endDate : currentGage.periodOfRecord.stage.endDate;

        let periodOfRecordText = "Period of Record: ";
        let startDateList = currentStartDate.split('-');
        let newStartDate = `${startDateList[1]}-${startDateList[2]}-${startDateList[0]}`;
        let endDateList = currentEndDate.split('-');
        let newEndDate = `${endDateList[1]}-${endDateList[2]}-${endDateList[0]}`;
        periodOfRecordText += `${newStartDate} to ${newEndDate}`;

        // Find Missing Dates
        let datesList = [];
        try{
            currentGage.dataValues.forEach(element => {
                let date = `${element['date'].split(' ')[0]}`;
                let month = date.split('-')[0];
                let day = date.split('-')[1];
                let year = date.split('-')[2];
                datesList.push(`${month}-${day}-${year}`);
            });
        } catch (error) {
            console.error('An error occurred:', error.message);
            console.log(`Error at gage '${currentGage.name}'`);
        }

        let missingDatesList = findMissingDates(datesList);

        let actualMissingDates = [];

        missingDatesList.forEach(date => {
            let missingReformattedDate = `${date.split('-')[1]}-${date.split('-')[2]}-${date.split('-')[0]}`;
            if (!datesList.includes(missingReformattedDate)){
                actualMissingDates.push(missingReformattedDate);
            }
        });

        let missingDateText = null;

        if (actualMissingDates.length > 0){
            missingDateText = `${actualMissingDates.length}`;
        };

        let jsonMetadata = {
            datum: currentGage.isProject ? currentGage.navd88 + datumText: currentGage.metadata.elevation + datumText,
            recordTime: recordTimeText,
            periodOfRecord: periodOfRecordText,
            missingDates: missingDateText,
            disclamer: disclamerText
        };

        let dssBeginDateList = beginDate.value.split('-');
        let dssEndDateList = endDate.value.split('-');

        let yearMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        let dssStartDate = `${dssBeginDateList[2]}${yearMonths[parseInt(dssBeginDateList[1]) - 1]}${dssBeginDateList[0]}`;
        let dssEndDate = `${dssEndDateList[2]}${yearMonths[parseInt(dssEndDateList[1]) - 1]}${dssEndDateList[0]}`;

        let dssPart_E = missingDateText === null ? "1Day" : "IR-Day";

        if (hourlyCheckbox.checked) {
            dssPart_E = "30Minute";
        }

        let dssValues = {
            A: basinName.value,
            B: currentGage.name,
            C: dailyCheckbox.checked ? "Stage - Observed at 08:00" : "Stage",
            D: `${dssStartDate}-${dssEndDate}`,
            E: dssPart_E,
            F: "OBS"
        };

        jsonObject.push({
            gageName: currentGage.name,
            gageValues: {
                metadata: jsonMetadata,
                dss: dssValues,
                values: currentGage.dataValues
            }
        });

        counter += 1;

        processNextItem(counter, totalDataAmount, "Gage completed");
    
    });

    console.log("JSON File: ", jsonObject);

    let outputFileName = `${basinName.value}`;
    outputFileName += dailyCheckbox.checked ? "-Daily" : "-Hourly";

    // Convert data to JSON
    let json = JSON.stringify(jsonObject, null, 2);

    // Create a blob from the JSON
    let blob = new Blob([json], { type: 'application/json' });

    // Create a link to download the JSON file
    let link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = `${outputFileName}.json`;
    link.click();

    if (haveGageData){
        disableFilesBtns();
    }

    elementObjList.forEach(element => {
        element.element.disabled = element.active;
    });

    if (!haveClass(progressBarDiv, 'hidden')){
        progressBarDiv.classList.add('hidden');
    }

    console.log("JSON file for Basin saved.");

    //loadingDiv.classList.remove('show');

}

function addOneDayToDate(date) {
    let startDay = parseInt(date.split('-')[1]);
    let startMonth = parseInt(date.split('-')[0]);
    let startYear = parseInt(date.split('-')[2]);

    let dateFormatted = new Date(startYear, startMonth - 1, startDay);
    dateFormatted.setDate(dateFormatted.getDate() + 1);

    let newMonth = String(dateFormatted.getMonth() + 1).padStart(2, "0");
    let newDay = String(dateFormatted.getDate()).padStart(2, "0");
    let newYear = dateFormatted.getFullYear();

    return `${newMonth}-${newDay}-${newYear}`;
}

function openOutlookMail() {

    // Download Excel File
    let filename = gageName.value;

    // Convert the JavaScript object into a worksheet
    const ws = XLSX.utils.json_to_sheet(globalData);

    // Create a new workbook and append the worksheet
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

    // Generate the Excel file as a Blob
    const excelBlob = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const file = new Blob([excelBlob], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

    let emailDates = {
        begin: `'${beginDate.value.split('-')[1]}-${beginDate.value.split('-')[2]}-${beginDate.value.split('-')[0]}'`,
        end: `'${endDate.value.split('-')[1]}-${endDate.value.split('-')[2]}-${endDate.value.split('-')[0]}'`,
    };

    const email = '';  // Replace with the recipient's email
    const subject = `Data Request for ${gageName.value}`; // Replace with the email subject
    const body = `Hi [Recipient],

Please find below the information for the following gage:

- Gage Name: ${gageName.value}
- Time Window: From ${emailDates.begin} to ${emailDates.end}
- Latitude: ${gageMetadata.latitude}
- Longitude: ${gageMetadata.longitude}
- Gage Elevation: ${gageMetadata.elevation}
- Vertical Datum: ${gageMetadata['vertical-datum']}

**NOTE FOR USER** 
- Please make sure to replace all the fields in square brackets ([]) with the appropriate information before sending this email.
- Ensure that you attach the files you downloaded from the page. This message is for your reference only and can be deleted before sending.

${disclamerText}

Thank you,
[Your Name]
[Your Position/Department]
[Your Organization]
[Your Contact Information]`; // Replace with the email body

    // Create the mailto link
    const mailtoLink = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    // Open the default email client (could be Outlook if it's set as default)
    window.location.href = mailtoLink;
}

// Example of storing user input as JSON
function saveUserData(userData) {
    const jsonData = JSON.stringify(userData);  // Convert to JSON string
    localStorage.setItem('userDataDataRequest', jsonData); // Store in localStorage
    console.log('Data saved: ', userData);
  }
  
// Example of retrieving user data from localStorage
function loadUserData() {
    const savedData = localStorage.getItem('userDataDataRequest');

    if (savedData) {
        const userData = JSON.parse(savedData);  // Convert from JSON string to object
        console.log("User Data: ", userData);

        return userData;

    } else {
        console.log("No saved user data found.");

        return null;
    }
}
