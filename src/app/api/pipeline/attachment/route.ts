import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const proposal = await prisma.proposal.findUnique({
    where: { id },
    select: { attachmentName: true, attachmentType: true, attachmentData: true },
  })

  if (!proposal?.attachmentData || !proposal.attachmentName) {
    return NextResponse.json({ error: 'Sem anexo' }, { status: 404 })
  }

  const buffer = Buffer.from(proposal.attachmentData, 'base64')
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': proposal.attachmentType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(proposal.attachmentName)}"`,
    },
  })
}
