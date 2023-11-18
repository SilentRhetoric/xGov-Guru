export function numberWithCommas(num: number | string): string {
  const num_parts = num.toString().split(".")
  num_parts[0] = num_parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return num_parts.join(".")
}

export function formatNumWithDecimals(num: number, decimals: number): string {
  const shifted_num = (num /= Math.pow(10, decimals))
  const shifted_num_string = shifted_num.toString()
  return shifted_num_string
}

export const dateOptions: Intl.DateTimeFormatOptions = {
  weekday: "short",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  timeZoneName: "short",
}

export function timeBetweenDates(validTill: string | number) {
  const validFromDate = new Date()
  const validTillTimeStamp = Number(validTill)
  const validTillDate = new Date(validTillTimeStamp)
  const difference = validTillDate.getTime() - validFromDate.getTime()

  let timeData = {
    days: "00",
    hours: "00",
    minutes: "00",
    seconds: "00",
  }

  if (difference > 0) {
    let seconds = Math.floor(difference / 1000)
    let minutes = Math.floor(seconds / 60)
    let hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    hours %= 24
    minutes %= 60
    seconds %= 60

    timeData = {
      days: `${days}`,
      hours: `${hours}`,
      minutes: `${minutes}`,
      seconds: `${seconds}`,
    }
  }
  return {
    timeData,
    difference,
  }
}
