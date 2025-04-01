
export function blurBackground () {
    let blur = document.querySelector('#page-container .page-content');
    blur.classList.toggle('blur');
    let popupWindow = document.getElementById('popup-window');
    popupWindow.classList.toggle('active');
}

// Get name list
export function getNames(data) {
    // Empty list to hold the new objects
    let objArray = []

    // Loop through all the basins
    data.forEach(element => {

        // Temporary hold list to get the datman names from each basin
        let tempList = [];

        // Loop through all the gages in the current basin and add the datman name to the temp list
        element['assigned-locations'].forEach(item => {
            tempList.push(item['location-id']);
        });

        let gagesList = tempList.filter(n => n != null);

        // Add a new object with the basin name and gages list to the object array
        if (gagesList.length > 0) {
            objArray.push({
                basin: element['id'],
                datman: gagesList,
            })
        };
    });

    return objArray;
}

export function popupMessage (msgType, message) {
    let popupTitle = document.getElementById('popup-title');
    let popupMessage = document.getElementById('popup-message');
    if (msgType === "warning") {
        popupTitle.innerHTML = "Warning";
    } else if (msgType === "error") {
        popupTitle.innerHTML = "Error";
    } else {
        popupTitle.innerHTML = "Message";
    }
    popupMessage.innerHTML = message;
}

// Add Values to combobox
export function addBasinNames(combobox, objectList) {
    objectList.forEach(element => {
        let option = document.createElement('option');
        option.value = element['basin'];
        option.textContent = element['basin']; 
        combobox.appendChild(option);
    });
}

// Check is the dates have at least one year data
export function haveOneYearOfData(startDate, endDate) {
    let startYear = startDate.split('-')[0];
    let startMonth = startDate.split('-')[1];
    let startDay = startDate.split('-')[2];

    let endYear = endDate.split('-')[0];
    let endMonth = endDate.split('-')[1];
    let endDay = endDate.split('-')[2];
    
    if (parseInt(endYear) - parseInt(startYear) === 0) {
        if (parseInt(endMonth) - parseInt(startMonth) === 11 && parseInt(endDay) - parseInt(startDay) === 30) {
            return true;
        } else {
            return false;
        };
    } else if (parseInt(endYear) - parseInt(startYear) === 1) {
        if (parseInt(endMonth) >= parseInt(startMonth) && parseInt(endDay) >= parseInt(startDay)) {
            return true;
        } else {
            return false;
        };
    } else {
        return true;
    };

}

// Show loading animation
export function showLoading() {
    let blur = document.querySelector('#page-container .page-content');
    blur.classList.toggle('blur');
    let loading = document.getElementById('loading-image');
    loading.classList.toggle('show');
}

// Format date to desired format
export function formatDate(date, monthsObj) {
    let stringDate = `${date}`; // mm-dd-yyyy hh24:mi
    let formattedDateList = stringDate.split(' ');
    return `${monthsObj[formattedDateList[1]]}-${formattedDateList[2]}-${formattedDateList[3]} ${formattedDateList[4].split(':')[0]}:${formattedDateList[4].split(':')[1]}`;
}
