import type { OrbitClientOptions } from './config.js'
import { createTransport, type OrbitTransport } from './transport/index.js'
import { ContactResource } from './resources/contacts.js'
import { CompanyResource } from './resources/companies.js'
import { DealResource } from './resources/deals.js'
import { PipelineResource } from './resources/pipelines.js'
import { StageResource } from './resources/stages.js'
import { UserResource } from './resources/users.js'
import { SearchResource } from './search.js'

export class OrbitClient {
  private readonly transport: OrbitTransport

  readonly contacts: ContactResource
  readonly companies: CompanyResource
  readonly deals: DealResource
  readonly pipelines: PipelineResource
  readonly stages: StageResource
  readonly users: UserResource
  readonly search: SearchResource

  constructor(public readonly options: OrbitClientOptions) {
    this.transport = createTransport(options)
    this.contacts = new ContactResource(this.transport)
    this.companies = new CompanyResource(this.transport)
    this.deals = new DealResource(this.transport)
    this.pipelines = new PipelineResource(this.transport)
    this.stages = new StageResource(this.transport)
    this.users = new UserResource(this.transport)
    this.search = new SearchResource(this.transport)
  }
}
