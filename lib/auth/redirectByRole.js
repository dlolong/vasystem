export function getDashboardPath(role) {
  switch (role) {
    case "agency":
      return "/agency";
    case "va":
      return "/va";
    case "client":
      return "/clien/dashboardt";
    default:
      return "/login";
  }
}