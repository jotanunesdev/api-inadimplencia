import { graphClient } from '../clients/graphClient';
import type { M365UserPhoto } from '../types/graph';
import { AppError } from '../types/errors';
import { arrayBufferToBase64 } from '../utils/base64';

export async function getUserPhotoById(
  userId: string,
  options: { throwOnMissing?: boolean } = {}
): Promise<M365UserPhoto | null> {
  const normalizedUserId = String(userId ?? '').trim();

  if (!normalizedUserId) {
    throw new AppError(400, 'O id do usuario e obrigatorio.', 'INVALID_USER_ID');
  }

  try {
    const photoResponse = await graphClient.getBinary(
      `/users/${encodeURIComponent(normalizedUserId)}/photo/$value`
    );

    return {
      base64: arrayBufferToBase64(photoResponse.buffer),
      contentType: photoResponse.contentType,
    };
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 404) {
      if (options.throwOnMissing) {
        throw new AppError(
          404,
          'Foto de perfil nao encontrada para o usuario informado.',
          'USER_PHOTO_NOT_FOUND'
        );
      }

      return null;
    }

    throw error;
  }
}
