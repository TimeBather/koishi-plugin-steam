import {SteamBinding} from './structure'
import {Command, Context, Session} from "koishi";
import {Quester} from '@satorijs/core'

function get_nickname(session:Session){
  return (session.channelName??session.guildName)??session.username
}

function extract_vanity_url(url:string){
  const match = url.match(/https?:\/\/steamcommunity\.com\/id\/(.+)/)
  if(match){
    return match[1]
  }
}

async function vanity_url_to_id(client:Quester,id:string,key:string){
  const data = await client.get('/ISteamUser/ResolveVanityURL/v1/',{
    params:{
      key:key,
      vanityurl:id
    }
  })
  if(data.response.success == 42)
    return null
  return data.response.steamid
}

async function get_player_summaries(client:Quester,steam_id:string,key:string){
  const data = await client.get('/ISteamUser/GetPlayerSummaries/v2/',{
    params:{
      key:key,
      steamids:steam_id
    }
  })
  return data.response?.players?.[0]
}

async function upsert_steam_account_information(ctx:Context,nickname:string,user_id:number,channel_id:string,platform_id:string,steam_id:string,steam_name:string){
  const binding = (await ctx.database.get('steam_bindings',{
    user_id:user_id,
    steam_id:steam_id
  }))?.[0]
  if(binding){
    binding.platform_names[channel_id] = nickname
    await ctx.database.set('steam_bindings',{
      user_id:user_id,
      steam_id:steam_id
    },{
      user_name:steam_name,
      platform_names:binding.platform_names
    })
  }
  await ctx.database.create('steam_bindings',{
    user_id:user_id,
    steam_id:steam_id,
    user_name:steam_name,
    platform_names:{
      [channel_id]:nickname
    }
  })
}

export async function bind_account(ctx:Context,session:Session<'id'|'default_steam_id'>,id:string,client:Quester,api_key){
  const nickname = get_nickname(session)
  const vanity_url = extract_vanity_url(id)
  const steam_id = await vanity_url_to_id(client,vanity_url ?? id,api_key) ?? (/[0-9]{8,}/.test(id)?id:null)
  if(!steam_id){
    return '玩家不存在或请求失败!'
  }
  const player_summaries = await get_player_summaries(client,steam_id,api_key)
  if(!player_summaries){
    return '玩家不存在或请求失败!'
  }
  const steam_visibility = player_summaries.communityvisibilitystate
  if(steam_visibility == 1){
    return '玩家设置了隐私,无法绑定!'
  }
  const steam_name = player_summaries.personaname
  await upsert_steam_account_information(ctx,nickname,session.user.id,session.cid,session.platform,steam_id,steam_name)
  if(!session.user.default_steam_id)
    session.user.default_steam_id = steam_id
  return `绑定成功!Steam账号:${steam_name}(${steam_id})`
}
