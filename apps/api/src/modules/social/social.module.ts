import { Global, Module } from '@nestjs/common';
import { FeedController } from './feed.controller.js';
import { FeedService } from './feed.service.js';
import { FollowsController } from './follows.controller.js';
import { FollowsService } from './follows.service.js';
import { PostsController } from './posts.controller.js';
import { PostsService } from './posts.service.js';
import { ProfilesService } from './profiles.service.js';
import { SocialController } from './social.controller.js';
import { StoriesController } from './stories.controller.js';
import { StoriesService } from './stories.service.js';

@Global()
@Module({
  controllers: [SocialController, FollowsController, PostsController, FeedController, StoriesController],
  providers: [ProfilesService, FollowsService, PostsService, FeedService, StoriesService],
  exports: [ProfilesService, FollowsService, PostsService, StoriesService],
})
export class SocialModule {}