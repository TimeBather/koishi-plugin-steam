import {Context, Schema, Session} from 'koishi'
import {} from 'koishi-plugin-puppeteer'
import {resolve} from 'path'
import {prepare_database, SteamBinding} from "./structure";
import {bind_account} from "./account";
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

  ctx.command("steam.bind <id:string>")
    .userFields(['id'])
    .action(async ({session},id)=>{
      return await bind_account(ctx,session,id,client,config.api_key)
    })

  ctx.command("steam.unbind [id:string]")
    .action(({session},id)=>{

    })

  ctx.command("steam.list")
    .action(({session})=>{

    })

  ctx.command("steam.recent [id:string]")
    .action(async ({session},id)=>{
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
