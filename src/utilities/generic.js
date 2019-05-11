function fetchItemFromArrayWithKey (array = [], key = '', value) {
  let itemToBeFetched = null
  array.forEach(item => {
    if (item && item[key] && item[key] === value) {
      itemToBeFetched = item
    }
  })

  return itemToBeFetched
}

// return a random number between 1 & 6
function getDiceRollNumber () {
  return 2
}

module.exports = {
  fetchItemFromArrayWithKey,
  getDiceRollNumber
}