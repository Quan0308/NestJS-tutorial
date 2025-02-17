import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { CommonService } from '../common/common.service';
import { Repository } from 'typeorm';
import { Post } from 'src/entities/post.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { CreatePostDto } from 'src/dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class PostService {
  constructor(
    @InjectRepository(Post)
    private postRepository: Repository<Post>,
    private readonly commonService: CommonService,
    private readonly usersService: UsersService
  ) {}

  async getViewablePosts(userId: number, authorId: number): Promise<Post[]> {
    try {
      const query = this.postRepository
        .createQueryBuilder('post')
        .select(['post.id', 'post.caption', 'post.imageUrl', 'post.createdAt', 'post.frame', 'post.font'])
        .leftJoin('post.visibleTo', 'visibleTo')
        .where('visibleTo.id = :id', { id: userId })
        .orderBy('post.createdAt', 'DESC')
        .leftJoin('post.author', 'author')
        .addSelect(['author.id', 'author.avatar', 'author.username'])
        .leftJoin('post.comments', 'comments', 'post.authorId = :userId', { userId })
        .loadRelationCountAndMap('post.countComments', 'post.comments', 'countComments')
        .leftJoin('post.reactions', 'reactions', 'post.authorId = :userId', { userId })
        .leftJoin('reactions.author', 'reactionAuthor')
        .addSelect(['reactions.type', 'reactionAuthor.avatar', 'reactionAuthor.username'])
        .addOrderBy('reactions.createdAt', 'DESC');
      if (authorId != 0) {
        query.andWhere('post.authorId = :id', { id: authorId });
      }
      return await query.getMany();
    } catch (error) {
      console.log(error);
      throw InternalServerErrorException;
    }
  }

  async getPostById(postId: number) {
    const post = await this.postRepository.createQueryBuilder('post').where('post.id = :postId', { postId }).getOne();

    if (!post) {
      throw new NotFoundException(`Post with id ${postId} not found`);
    }
    return post;
  }

  async create(file, content: CreatePostDto) {
    try {
      const { authorId, caption, visibleToIds, frame, font } = content;
      const imageUrl = await this.commonService.uploadImage(file);
      const newPost = this.postRepository.create({
        authorId,
        caption,
        imageUrl,
        frame,
        font,
      });
      newPost.visibleTo = await this.usersService.getUsersByIds(visibleToIds.concat(authorId).sort(), ['user.id']);
      return await this.postRepository.save(newPost);
    } catch (error) {
      console.log(error);
      throw InternalServerErrorException;
    }
  }
}
