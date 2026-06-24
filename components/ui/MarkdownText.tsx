import { Fragment } from "react"
import { Linking } from "react-native"
import { Text, XStack, YStack } from "tamagui"
import { UI_OPACITY, UI_FONT_WEIGHT, UI_SPACE } from "../../constants/ui-tokens"

const CODE_REGEX = /`([^`]+)`/
const LINK_REGEX = /\[([^\]]+)\]\(([^)]+)\)/
const BOLD_REGEX = /\*\*([^*]+)\*\*/

interface InlineSegment {
  text: string
  isCode?: boolean
  isLink?: boolean
  url?: string
  isBold?: boolean
}

function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = []
  let remaining = text

  while (remaining.length > 0) {
    const codeMatch = remaining.match(CODE_REGEX)
    const linkMatch = remaining.match(LINK_REGEX)
    const boldMatch = remaining.match(BOLD_REGEX)

    const matches: { index: number; length: number; type: string }[] = []
    if (codeMatch)
      matches.push({ index: codeMatch.index!, length: codeMatch[0].length, type: "code" })
    if (linkMatch)
      matches.push({ index: linkMatch.index!, length: linkMatch[0].length, type: "link" })
    if (boldMatch)
      matches.push({ index: boldMatch.index!, length: boldMatch[0].length, type: "bold" })

    if (matches.length === 0) {
      segments.push({ text: remaining })
      break
    }

    matches.sort((a, b) => a.index - b.index)
    const first = matches[0]

    if (first.index > 0) {
      segments.push({ text: remaining.slice(0, first.index) })
    }

    if (first.type === "code" && codeMatch) {
      segments.push({ text: codeMatch[1], isCode: true })
      remaining = remaining.slice(first.index + first.length)
    } else if (first.type === "link" && linkMatch) {
      segments.push({ text: linkMatch[1], isLink: true, url: linkMatch[2] })
      remaining = remaining.slice(first.index + first.length)
    } else if (first.type === "bold" && boldMatch) {
      segments.push({ text: boldMatch[1], isBold: true })
      remaining = remaining.slice(first.index + first.length)
    } else {
      segments.push({ text: remaining[0] })
      remaining = remaining.slice(1)
    }
  }

  return segments
}

function InlineText({ segments }: { segments: InlineSegment[] }) {
  return (
    <Text fontSize="$body" lineHeight={22} color="$color">
      {segments.map((seg, i) => {
        if (seg.isCode) {
          return (
            <Text
              key={i}
              fontSize="$body"
              style={{
                backgroundColor: "transparent",
                paddingHorizontal: 3,
                borderRadius: 2,
              }}
            >
              {seg.text}
            </Text>
          )
        }
        if (seg.isLink && seg.url) {
          return (
            <Text
              key={i}
              fontSize="$body"
              color="$color"
              textDecorationLine="underline"
              cursor="pointer"
              onPress={() => Linking.openURL(seg.url!)}
              hoverStyle={{ opacity: UI_OPACITY.medium }}
            >
              {seg.text}
            </Text>
          )
        }
        if (seg.isBold) {
          return (
            <Text key={i} fontSize="$body" fontWeight={UI_FONT_WEIGHT.bold}>
              {seg.text}
            </Text>
          )
        }
        return <Fragment key={i}>{seg.text}</Fragment>
      })}
    </Text>
  )
}

interface MarkdownTextProps {
  children: string
}

export function MarkdownText({ children }: MarkdownTextProps) {
  const lines = children.split("\n")

  return (
    <YStack gap="$section">
      {lines.map((line, i) => {
        if (line.trim() === "") {
          return <YStack key={i} height={UI_SPACE.control} />
        }

        const headingMatch = line.match(/^###\s+(.+)/)
        if (headingMatch) {
          return (
            <Text
              key={i}
              fontSize="$label"
              fontWeight={UI_FONT_WEIGHT.bold}
              color="$color"
              style={{ marginTop: UI_SPACE.control }}
            >
              {headingMatch[1]}
            </Text>
          )
        }

        const listMatch = line.match(/^(\s*)[-*]\s+(.+)/)
        if (listMatch) {
          const indent = listMatch[1].length
          const content = listMatch[2]
          const segments = parseInline(content)
          return (
            <XStack
              key={i}
              gap="$section"
              style={{ paddingLeft: indent > 0 ? UI_SPACE.block : 0 }}
            >
              <Text
                fontSize="$body"
                lineHeight={22}
                color="$color"
                opacity={UI_OPACITY.medium}
              >
                {"\u2022"}
              </Text>
              <YStack flex={1}>
                <InlineText segments={segments} />
              </YStack>
            </XStack>
          )
        }

        const segments = parseInline(line)
        return (
          <XStack key={i}>
            <InlineText segments={segments} />
          </XStack>
        )
      })}
    </YStack>
  )
}
