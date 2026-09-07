@Component({ selector: 'app-root' })
export class AppComponent {
  @Input() name!: string;
  @Output() changed = new EventEmitter<string>();
  @HostListener('click', ['$event'])
  onClick(@Inject(TOKEN) event: Event, @Optional() other?: string): void {}
  @observable accessor count = 0;
}

export class Nested {
  @first @second() @third.member() method() {}
}
