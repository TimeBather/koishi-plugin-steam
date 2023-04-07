function daysInYear(year) {
  return ((year % 4 === 0 && year % 100 > 0) || year %400 === 0) ? 366 : 365;
}

function generate_calender_slots(data){
  const slots = []
  const currentYearStartDate = new Date(new Date().getFullYear(), 0, 1)
  const currentYearStartDayWeekDay = currentYearStartDate.getDay()
  for(let i=0;i<currentYearStartDayWeekDay;i++)
    slots.push(-1)
  for(let i=0;i<daysInYear(new Date().getFullYear());i++)
    slots.push(data?.[i]??0)
  for(let i=0;i<30;i++)
    slots.push(-1)
  return slots
}
