import {Context, Schema, Session} from 'koishi'
import {} from 'koishi-plugin-puppeteer'
import {resolve} from 'path'
import {prepare_database, SteamBinding} from "./structure";
import {bind_account, unbind_account} from "./account";
import {start_monitor} from "./monitoring";
import {get_steam_recent_info} from "./recent";
import {h, segment} from "@satorijs/core";


export const name = 'steam'

export const using = [ 'database','puppeteer' ]

export interface Config {
  api_key: string
}

export const Config: Schema<Config> = Schema.object({
  api_key:Schema.string()
})

function get_nickname(session:Session){
  return (session.channelName??session.guildName)??session.username
}

export function apply(ctx: Context,config:Config) {

  const client = ctx.http.extend({
    endpoint:'https://api.steampowered.com/',
  })

  ctx.command("steam.bind <id:string> [name:string]")
    .userFields(['id', 'default_steam_id'])
    .option('-s', '绑定为自己的昵称')
    .action(async ({session,options}, id,name) => {
      if(!id)
        return segment('at',session.userId) + " 请填写你的 Steam ID 或 个性化 URL"
      if(options["-s"])
        name = get_nickname(session)
      return await bind_account(ctx, session, id, name, client, config.api_key)
    })

  ctx.command("steam.unbind [id:string]")
    .userFields(['id'])
    .action(async ({session}, id) => {
      if(!id)
        return segment('at',session.userId) + " 请填写你的 Steam ID"
      return await unbind_account(ctx, session, id)
    })

  ctx.command("steam.list")
    .userFields(['id'])
    .action(async ({session}) => {
      const bindings = await ctx.database.get('steam_bindings', {
        user_id: session.user.id
      })
      if (bindings.length == 0)
        return segment('at', session.userId) + " 没有绑定 Steam 账号"
      return '您绑定了下列Steam账号:\n'+bindings.filter(binding=>binding.platform_names[session.cid]).map(binding=>{
        return `${binding.user_name} ${binding.platform_names[session.cid]?`-> ${binding.platform_names[session.cid]} `:''}(${binding.steam_id})`
      })
  })

  ctx.command("steam.recent [id:string]")
    .userFields(['default_steam_id'])
    .action(async ({session},id)=>{
      if(!id)
        id = session.user.default_steam_id
      if(!id)
        return segment('at',session.userId) + " 请先绑定 Steam 账号"
      try{
        const summary = await get_steam_recent_info(ctx,id)
        let page = await ctx.puppeteer.page();
        await page.setViewport({ width: 1920 * 2, height: 1080 * 2 });
        await page.goto(`file:///${resolve(__dirname, "../assets/recent.html")}`)
        await page.waitForNetworkIdle();
        await page.evaluate(`render(${JSON.stringify(summary)})`);
        const element = await page.$("#app");
        let image = await element.screenshot({
          encoding: "binary",
          type:"jpeg",
          quality:100
        })
        await page.close()
        return h.image(image, "image/png")
      }catch (e){
        console.error(e)
      }
    })

  prepare_database(ctx)

  start_monitor(ctx,client,config.api_key)
}
