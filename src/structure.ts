import {Context, Dict} from "koishi";

declare module "koishi"{
  interface Tables{
    steam_bindings:SteamBinding,
    steam_activities:SteamActivity,
    steam_games:SteamGame,
    steam_activity_summaries:SteamActivitySummary,
    steam_game_sessions:SteamGameSession
  }
}

export interface SteamGameSession{
  steam_id: string
  game_id: string
  target_activity: number
  last_update:Date
}

export interface SteamBinding{
  user_id: number
  steam_id: string
  user_name: string
  platform_names: Dict<string>
  is_default:boolean
}

export interface SteamActivity{
  id: number
  steam_id: string
  begin: Date
  end: Date
  duration: number
  game: string
}

export interface SteamGame{
  id: string
  name: string
}

export interface SteamActivitySummary{
  steam_id: string
  date: Date
  heat: number
  activity: string
}

export function prepare_database(ctx:Context){

  ctx.database.extend("steam_bindings",{
    user_id: 'integer',
    steam_id: 'string',
    user_name: 'string',
    platform_names: 'json',
    is_default: 'boolean'
  },{
    primary:['user_id','steam_id']
  })

  ctx.database.extend("steam_activities",{
    id: 'integer',
    steam_id: 'string',
    begin: 'timestamp',
    end: 'timestamp',
    game: 'string',
    duration: 'integer'
  },{
    primary:'id',
    autoInc:true
  })

  ctx.database.extend("steam_games",{
    id: 'string',
    name: 'string'
  },{
    primary:'id'
  })

  ctx.database.extend("steam_activity_summaries",{
    steam_id: 'string',
    date: 'date',
    heat: 'integer',
    activity: 'string'
  },{
    primary:['steam_id','date']
  })

  ctx.database.extend("steam_game_sessions",{
    steam_id: 'string',
    game_id: 'string',
    last_update: 'timestamp',
    target_activity: 'integer'
  },{
    primary:['steam_id']
  })
}
