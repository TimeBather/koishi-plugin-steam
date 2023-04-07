import {Context} from "koishi";

export function get_steam_recent(ctx:Context,steam_id:string){
  const activities = ctx.database.get("steam_activities",{
    steam_id:steam_id,
    begin:{
      $gt:new Date(new Date().getTime() - 24*60*60*1000)
    }
  })
  return activities
}
