import { field } from '@lolpants/jogger'
import { type ArgsOf, Discord, On } from 'discordx'
import { generateVoteButtons } from '~/lib/buttons.js'
import { generateEmbed } from '~/lib/embeds.js'
import { manager } from '~/lib/manager.js'
import { logger } from '~/logger.js'

@Discord()
export abstract class MessageDelete {
  @On('messageDelete')
  public async onMessageDelete([message]: ArgsOf<'messageDelete'>) {
    const vote = manager.getVote(message.id)
    if (vote === undefined) return

    const description = `${vote.initiator} has started a vote to strip roles from ${vote.target}`
    const embed = generateEmbed({
      description,
      progress: vote.progress,
      votes: vote.voterList,
    })

    const mentionsArray = await vote.mentions(false)
    const mentions = mentionsArray.join(' ')
    const buttons = generateVoteButtons({ cancelData: [vote.initiator.id] })

    const newMessage = await message.channel.send({
      content: mentions,
      embeds: [embed],
      components: [buttons],
    })

    vote.replaceMessage(newMessage)
    logger.info(
      field('context', 'vote'),
      field('action', 'message-replaced'),
      field('oldID', message.id),
      field('newID', newMessage.id)
    )
  }
}
