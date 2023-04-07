import {Context} from "koishi";

export async function get_steam_recent_info(ctx:Context,id:string){
  const player = (await ctx.database.get("steam_bindings",{
    steam_id:id
  }))?.[0]
  if(!player)
    return null
  const session = (await ctx.database.get("steam_game_sessions",{
    steam_id:id,
  }))?.[0]
  let status = player.user_name + ' '
  if(session && session.game_id){
    if(session.game_id=='IDLE'){
      status += '当前在线'
    }else{
      const game = (await ctx.database.get("steam_games",{
        id:session.game_id,
      }))?.[0]
      if(!game){
        status += '当前在线'
      }else{
        status += `正在玩 《${game.name}》`
      }
    }
  }
  const summaries = await ctx.database.get("steam_activity_summaries",{
    date:{
        $gt:new Date(new Date().setMonth(0,1))
    },
    steam_id:id
  })
  const time = (new Array(366)).fill(0)
  for(let summary of summaries){
    const day = Math.ceil((summary.date.getTime() - new Date(new Date().setMonth(0,1)).getTime())/(24*60*60*1000))
    time[day] = (Math.min(Math.ceil(summary.heat/60/60),4))/4
  }

  const recent = await ctx.database.get("steam_activities",{
    steam_id:id,
    begin:{
      $gt:new Date(new Date().getTime() - 24*60*60*1000)
    }
  })

  const offset = -(new Date()).getHours()*4 - Math.floor((new Date()).getMinutes()/15)-1
  const bars = (new Array(24*4)).fill(0)
  console.info(recent)
  for(let activity of recent){
    const begin = (activity.begin.getHours()*4 + Math.floor(activity.begin.getMinutes()/15) + offset + 24*4)%(24*4)
    const activity_end = activity.duration==-1?new Date():new Date(activity.begin.getTime() + activity.duration*1000)
    const end = (activity_end.getHours()*4 + Math.floor(activity_end.getMinutes()/15) + offset + 24*4)%(24*4)
    console.info(activity.game,begin,end)
    for(let i = begin;i<=end;i++){
      bars[i] = Math.max(bars[i],activity.game=='IDLE'?1:2)
    }
  }
  return {
    daily_totals:time,
    recent:bars,
    offset:offset,
    username:player.user_name,
    status
  }
}
