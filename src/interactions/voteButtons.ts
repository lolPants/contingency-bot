import { field } from '@lolpants/jogger'
import {
  type ButtonInteraction,
  DiscordAPIError,
  Message,
  type MessageEmbed,
} from 'discord.js'
import { ButtonComponent, Discord } from 'discordx'
import { env } from '~/env.js'
import { generateVoteButtons } from '~/lib/buttons.js'
import { Colours, Reply, VoteResult } from '~/lib/constants.js'
import { interactionRX } from '~/lib/interactions.js'
import { manager } from '~/lib/manager.js'
import { logger } from '~/logger.js'

export const cancelVote = async (
  button: ButtonInteraction,
  embed: MessageEmbed
) => {
  const buttons = generateVoteButtons({ disabled: true })
  await button.update({ embeds: [embed], components: [buttons] })
}

class CustomError extends Error {}

@Discord()
export abstract class VoteButtons {
  @ButtonComponent(interactionRX('vote', 'approve'))
  public async runApprove(button: ButtonInteraction) {
    if (!button.guild) throw new Error('missing guild')
    if (!button.channel) throw new Error('missing channel')

    const message =
      button.message instanceof Message
        ? button.message
        : await button.channel.messages.fetch(button.message.id)

    const messageID = button.message.id
    const vote = manager.getVote(messageID)

    if (vote === undefined) {
      const embed = message.embeds[0]
      embed.setColor(Colours.GREY)
      embed.setDescription(
        `~~${embed.description}~~\n**${VoteResult.EXPIRED}**`
      )

      await cancelVote(button, embed)
      return
    }

    const member = button.guild.members.cache.get(button.user.id)
    if (!member) throw new Error('missing member')

    const reply = async (message: string) => {
      await button.reply({ content: message, ephemeral: true })
    }

    if (vote.isTarget(member)) {
      await reply(Reply.ERR_IS_TARGET)
      return
    }

    if (!vote.canVote(member)) {
      await reply(Reply.ERR_NO_PERM)
      return
    }

    if (vote.hasVoted(member)) {
      await reply(Reply.ALREADY_VOTED)
      return
    }

    vote.approve(member)
    logger.info(
      field('context', 'vote'),
      field('action', 'approve'),
      field('id', vote.message.id),
      field('user', member.user.tag),
      field('userID', member.id),
      field('progress', vote.progress)
    )

    const embed = message.embeds[0]
    embed.fields[0].value = vote.progress
    embed.fields[1].value = vote.voterList

    if (vote.isMet) {
      embed.setDescription(`~~${embed.description}~~\n**${VoteResult.PASSED}**`)

      vote.cancel(undefined)
      await cancelVote(button, embed)

      logger.info(
        field('context', 'vote'),
        field('action', 'passed'),
        field('id', vote.message.id)
      )

      try {
        if (env.DRY_RUN === false) {
          await vote.target.roles.remove(
            vote.target.roles.cache,
            `Emergency vote called by ${vote.initiator.user.tag}`
          )
        } else {
          // Check permissions anyway
          const hasPerms =
            vote.message.guild?.me?.permissions.has('MANAGE_ROLES')
          if (hasPerms === false) {
            throw new CustomError('Missing Permissions')
          }
        }

        embed.setColor(Colours.GREEN)
        embed.setDescription(
          `${embed.description}\n\nAll roles removed from ${vote.target} successfully!`
        )
      } catch (error: unknown) {
        embed.setColor(Colours.GREY)
        embed.setDescription(
          `${embed.description}\n\nFailed to remove roles from ${vote.target}`
        )

        if (error instanceof DiscordAPIError || error instanceof CustomError) {
          embed.setDescription(`${embed.description}\n**${error.message}.**`)
        }
      }
    }

    await (vote.isMet
      ? message.edit({ embeds: [embed] })
      : button.update({ embeds: [embed] }))
  }

  @ButtonComponent(interactionRX('vote', 'revoke'))
  public async runRevoke(button: ButtonInteraction) {
    if (!button.guild) throw new Error('missing guild')
    if (!button.channel) throw new Error('missing channel')

    const message =
      button.message instanceof Message
        ? button.message
        : await button.channel.messages.fetch(button.message.id)

    const messageID = button.message.id
    const vote = manager.getVote(messageID)

    if (vote === undefined) {
      const embed = message.embeds[0]
      embed.setColor(Colours.GREY)
      embed.setDescription(
        `~~${embed.description}~~\n**${VoteResult.EXPIRED}**`
      )

      await cancelVote(button, embed)
      return
    }

    const member = button.guild.members.cache.get(button.user.id)
    if (!member) throw new Error('missing member')

    const reply = async (message: string) => {
      await button.reply({ content: message, ephemeral: true })
    }

    if (!vote.canVote(member)) {
      await reply(Reply.ERR_NO_PERM)
      return
    }

    if (!vote.hasVoted(member)) {
      await reply(Reply.NOT_VOTED)
      return
    }

    vote.revoke(member)
    logger.info(
      field('context', 'vote'),
      field('action', 'revoke'),
      field('id', vote.message.id),
      field('user', member.user.tag),
      field('userID', member.id),
      field('progress', vote.progress)
    )

    const embed = message.embeds[0]
    embed.fields[0].value = vote.progress
    embed.fields[1].value = vote.voterList

    await button.update({ embeds: [embed] })
  }

  @ButtonComponent(interactionRX('vote', 'cancel'))
  public async runCancel(button: ButtonInteraction) {
    if (!button.guild) throw new Error('missing guild')
    if (!button.channel) throw new Error('missing channel')

    const message =
      button.message instanceof Message
        ? button.message
        : await button.channel.messages.fetch(button.message.id)

    const messageID = button.message.id
    const vote = manager.getVote(messageID)

    if (vote === undefined) {
      const embed = message.embeds[0]
      embed.setColor(Colours.GREY)
      embed.setDescription(
        `~~${embed.description}~~\n**${VoteResult.EXPIRED}**`
      )

      await cancelVote(button, embed)
      return
    }

    const member = button.guild.members.cache.get(button.user.id)
    if (!member) throw new Error('missing member')

    if (!vote.isInitiator(member)) {
      await button.reply({
        content: Reply.ERR_NOT_INITIATOR_CANCEL,
        ephemeral: true,
      })

      return
    }

    const embed = message.embeds[0]
    embed.setColor(Colours.GREY)
    embed.setDescription(
      `~~${embed.description}~~\n**${VoteResult.CANCELLED}**`
    )

    vote.cancel(member)
    await cancelVote(button, embed)

    logger.info(
      field('context', 'vote'),
      field('action', 'cancel'),
      field('id', vote.message.id)
    )
  }
}
