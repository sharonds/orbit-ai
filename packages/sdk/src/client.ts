import type { OrbitClientOptions } from './config.js'
import { createTransport, type OrbitTransport } from './transport/index.js'
import { ContactResource } from './resources/contacts.js'
import { CompanyResource } from './resources/companies.js'
import { DealResource } from './resources/deals.js'
import { PipelineResource } from './resources/pipelines.js'
import { StageResource } from './resources/stages.js'
import { UserResource } from './resources/users.js'
import { ActivityResource } from './resources/activities.js'
import { TaskResource } from './resources/tasks.js'
import { NoteResource } from './resources/notes.js'
import { ProductResource } from './resources/products.js'
import { PaymentResource } from './resources/payments.js'
import { ContractResource } from './resources/contracts.js'
import { SequenceResource } from './resources/sequences.js'
import { SequenceStepResource } from './resources/sequence-steps.js'
import { SequenceEnrollmentResource } from './resources/sequence-enrollments.js'
import { SequenceEventResource } from './resources/sequence-events.js'
import { TagResource } from './resources/tags.js'
import { SchemaResource } from './resources/schema.js'
import { WebhookResource } from './resources/webhooks.js'
import { ImportResource } from './resources/imports.js'
import { SearchResource } from './search.js'

export class OrbitClient {
  private readonly transport: OrbitTransport

  // Wave 1
  readonly contacts: ContactResource
  readonly companies: CompanyResource
  readonly deals: DealResource
  readonly pipelines: PipelineResource
  readonly stages: StageResource
  readonly users: UserResource
  readonly search: SearchResource

  // Wave 2
  readonly activities: ActivityResource
  readonly tasks: TaskResource
  readonly notes: NoteResource
  readonly products: ProductResource
  readonly payments: PaymentResource
  readonly contracts: ContractResource
  readonly sequences: SequenceResource
  readonly sequenceSteps: SequenceStepResource
  readonly sequenceEnrollments: SequenceEnrollmentResource
  readonly sequenceEvents: SequenceEventResource
  readonly tags: TagResource
  readonly schema: SchemaResource
  readonly webhooks: WebhookResource
  readonly imports: ImportResource

  constructor(public readonly options: OrbitClientOptions) {
    this.transport = createTransport(options)

    // Wave 1
    this.contacts = new ContactResource(this.transport)
    this.companies = new CompanyResource(this.transport)
    this.deals = new DealResource(this.transport)
    this.pipelines = new PipelineResource(this.transport)
    this.stages = new StageResource(this.transport)
    this.users = new UserResource(this.transport)
    this.search = new SearchResource(this.transport)

    // Wave 2
    this.activities = new ActivityResource(this.transport)
    this.tasks = new TaskResource(this.transport)
    this.notes = new NoteResource(this.transport)
    this.products = new ProductResource(this.transport)
    this.payments = new PaymentResource(this.transport)
    this.contracts = new ContractResource(this.transport)
    this.sequences = new SequenceResource(this.transport)
    this.sequenceSteps = new SequenceStepResource(this.transport)
    this.sequenceEnrollments = new SequenceEnrollmentResource(this.transport)
    this.sequenceEvents = new SequenceEventResource(this.transport)
    this.tags = new TagResource(this.transport)
    this.schema = new SchemaResource(this.transport)
    this.webhooks = new WebhookResource(this.transport)
    this.imports = new ImportResource(this.transport)
  }
}
