import {Context, deduplicate, Eval, Quester, $, Logger} from "koishi";
import {SteamBinding} from './structure'

async function get_player_status(client:Quester,key:string,ids:string[]){
  return (await client.get('/ISteamUser/GetPlayerSummaries/v2/',{
    params:{
      key:key,
      steamids:ids.join(',')
    }
  })).response
}

async function start_session(ctx:Context,info){
  if(!info.steamid)return
  const activity = await ctx.database.create('steam_activities',{
    steam_id:info.steamid,
    begin:new Date,
    end:new Date,
    game:info.gameid,
    duration:-1,
  })
  await ctx.database.create('steam_game_sessions',{
    steam_id:info.steamid,
    game_id:info.gameid,
    last_update:new Date,
    target_activity:activity.id
  })
}

async function end_session(ctx:Context,info,logger:Logger,forcing=false,debounce_num){
  if(!info.steamid)return
  const session = (await ctx.database.get('steam_game_sessions',{
    steam_id:info.steamid,
  }))?.[0]
  if(!session)
    return false
  if(!forcing && session.debounce<debounce_num){
    logger.debug(`Debouncing session end for ${info.steamid} , count = ${session.debounce}/${debounce_num}`)
    await ctx.database.set('steam_game_sessions',{
      steam_id:info.steamid,
    },{
      debounce:(session.debounce??0)+1
    })
    return false
  }
  const activity = (await ctx.database.get('steam_activities',{
    id:session.target_activity,
  }))?.[0]
  if(!activity){
    await ctx.database.remove('steam_game_sessions',{
      steam_id:info.steamid
    })
    return false
  }
  const duration = ((new Date).getTime() - activity.begin.getTime())/1000
  await ctx.database.set('steam_activities',{
    id:session.target_activity,
  },{
    end:session.last_update,
    duration
  })
  if(session.game_id!='IDLE'){
    await ctx.database.upsert('steam_activity_summaries',(row)=>([{
      steam_id:info.steamid,
      date:new Date(new Date().setHours(0,0,0,0)),
      heat:$.add(row.heat,duration),
    }]))
  }
  await ctx.database.remove('steam_game_sessions',{
    steam_id:info.steamid
  })
  return true
}

async function broadcast(ctx:Context,steam_id,type:boolean,game_name,duration,logger){
  logger.debug(`Broadcasting ${steam_id} ${type?'start':'end'} ${game_name} ${duration}`)
  const bindings = await ctx.database.get('steam_bindings',{
    steam_id:steam_id
  })
  for(const binding of bindings){
    const steam_name = binding.user_name
    const platform_names = binding.platform_names
    for(const channel in platform_names){
      const nickname = platform_names[channel]
      let message
      if(type){
        message = `${nickname}(${steam_name}) 正在玩: ${game_name}`
      }else{
        message = `${nickname}(${steam_name}) 玩了 ${Math.ceil(duration/60)} 分钟后，不玩${game_name}了`
      }
      console.info([channel],message)
      await ctx.broadcast([channel], message)
    }
  }
}

async function update_player_status(ctx: Context, response, logger: Logger, config){
  const session = (await ctx.database.get('steam_game_sessions',{
    steam_id:response.steamid
  }))?.[0]
  if(!response.gameid && !session) return
  if(response.gameid && response.gameid!='IDLE' && response.gameextrainfo){
    await ctx.database.upsert('steam_games',[
      {
        id:response.gameid,
        name:response.gameextrainfo
      }
    ])
  }
  if(session?.game_id!=response.gameid){
    if(session) {
      if(!await end_session(ctx, response, logger, session.game_id=='IDLE' && (response.gameid && response.gameid!='IDLE'),config.debounce))
        return
      if(session.game_id!='IDLE'){
        const game_name = (await ctx.database.get('steam_games',{
          id:session.game_id
        }))?.[0]?.name
        await broadcast(ctx,session.steam_id,false,game_name,((new Date).getTime() - session.last_update.getTime())/1000,logger)
      }
    }
    if(response.gameid) {
      await start_session(ctx, response)
      if(response.gameid!='IDLE')await broadcast(ctx,response.steamid,true,response.gameextrainfo,0,logger)
    }
  }
}

async function update_last_update(ctx: Context, player, logger: Logger) {
  const session = (await ctx.database.get('steam_game_sessions',{steam_id:player.steamid}))?.[0]
  if(!session)
    return
  if(!player.steamid){
    return
  }
  const debounce_fields = {}
  if(player.gameid==session.game_id){
    debounce_fields['debounce'] = 0
    if (session.debounce > 0)
      logger.debug('Debounce value reset for player '+player.steamid)
  }
  await ctx.database.set('steam_game_sessions',
    {
      steam_id:player.steamid
    },
    {
      last_update:new Date,
      ...debounce_fields
    }
  )
}

export function start_monitor(ctx:Context,client:Quester,key:string,config,logger:Logger){
  ctx.setInterval(async ()=>{
    const steam_ids = await ctx.database.get("steam_bindings",{})
    const steam_id_list = deduplicate(steam_ids.map((binding:SteamBinding)=>binding.steam_id))
    const player_statuses = await get_player_status(client,key,steam_id_list)
    for(const player of player_statuses.players){
      if(player.personastate==1 && !player.gameid)
        player.gameid = 'IDLE'
      await update_player_status(ctx,player,logger,config)
      await update_last_update(ctx,player,logger)
    }
  },config.interval*1000)
}
